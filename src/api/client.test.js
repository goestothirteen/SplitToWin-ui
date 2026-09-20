import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, awaitParse, parseReceipt, resumeParse } from "./client";

const PHOTO = new File([new Uint8Array([1, 2, 3])], "receipt.jpg", {
  type: "image/jpeg",
});

const RECEIPT = {
  currency: "SGD",
  items: [{ id: "i0", name: "Hokkien mee", quantity: 1, lineTotal: 7.5 }],
  subtotal: 7.5,
  total: 7.5,
  discrepancy: null,
  provider: "gemini",
  warnings: [],
};

const json = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const running = (itemsFound = 0, stage = "Reading the receipt") => ({
  jobId: "job1",
  status: "running",
  stage,
  detail: "",
  itemsFound,
  elapsedSeconds: 1.5,
});

/** Runs the polling loop forward without waiting a real second per poll.
 *  The outcome is captured before any timer moves, so a parse that fails on
 *  the first poll is never briefly an unhandled rejection. */
async function drain(promise, ticks = 12) {
  const settled = promise.then(
    (value) => () => value,
    (error) => () => {
      throw error;
    }
  );
  for (let i = 0; i < ticks; i += 1) {
    await vi.advanceTimersByTimeAsync(1000);
  }
  return (await settled)();
}

describe("parse polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uploads once, then polls until the receipt is ready", async () => {
    fetch
      .mockResolvedValueOnce(json({ jobId: "job1", status: "queued" }, 202))
      .mockResolvedValueOnce(json(running(0)))
      .mockResolvedValueOnce(json(running(3)))
      .mockResolvedValueOnce(
        json({ jobId: "job1", status: "done", receipt: RECEIPT })
      );

    const seen = [];
    const result = await drain(
      parseReceipt(PHOTO, { onProgress: (s) => seen.push(s.itemsFound) })
    );

    expect(result).toEqual(RECEIPT);
    // One POST and three polls — the photo is sent exactly once.
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(fetch.mock.calls[0][1].method).toBe("POST");
    expect(seen).toContain(3);
  });

  it("surfaces a refused photo with the code the panel branches on", async () => {
    fetch.mockResolvedValueOnce(json({ jobId: "job1", status: "queued" }, 202)).
      mockResolvedValueOnce(
        json({
          jobId: "job1",
          status: "failed",
          error: "That's the menu, not the bill.",
          code: "not_a_receipt",
        })
      );

    await expect(drain(parseReceipt(PHOTO))).rejects.toMatchObject({
      code: "not_a_receipt",
      message: "That's the menu, not the bill.",
    });
  });

  it("rides out a dropped poll rather than failing the parse", async () => {
    fetch
      .mockRejectedValueOnce(new TypeError("network"))
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(json({ jobId: "job1", status: "done", receipt: RECEIPT }));

    await expect(drain(awaitParse("job1"))).resolves.toEqual(RECEIPT);
  });

  it("gives up once the polls keep failing", async () => {
    fetch.mockRejectedValue(new TypeError("network"));
    await expect(drain(awaitParse("job1"))).rejects.toBeInstanceOf(ApiError);
  });

  it("resuming re-attaches to the job instead of re-uploading the photo", async () => {
    fetch.mockResolvedValueOnce(
      json({ jobId: "job1", status: "done", receipt: RECEIPT })
    );

    await expect(drain(resumeParse("job1", PHOTO))).resolves.toEqual(RECEIPT);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]?.method).toBeUndefined(); // a GET, not the upload
  });

  it("resuming a job the server has forgotten sends the photo again", async () => {
    fetch
      .mockResolvedValueOnce(
        json({ error: "That upload has expired.", code: "job_unknown" }, 404)
      )
      .mockResolvedValueOnce(json({ jobId: "job2", status: "queued" }, 202))
      .mockResolvedValueOnce(json({ jobId: "job2", status: "done", receipt: RECEIPT }));

    await expect(drain(resumeParse("job1", PHOTO))).resolves.toEqual(RECEIPT);
    expect(fetch.mock.calls[1][1].method).toBe("POST");
  });
});
