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
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uploads once, then polls until the receipt is ready", async () => {
    globalThis.fetch
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
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    expect(globalThis.fetch.mock.calls[0][1].method).toBe("POST");
    expect(seen).toContain(3);
  });

  it("sends the job id in the upload path so /stats can follow it", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(json({ jobId: "abc", status: "queued" }, 202))
      .mockResolvedValueOnce(json({ jobId: "abc", status: "done", receipt: RECEIPT }));

    await drain(parseReceipt(PHOTO, { jobId: "abc" }));
    expect(globalThis.fetch.mock.calls[0][0]).toContain("/parse-receipt/abc");
  });

  it("reads a failed parse off its body even though the code is not 200", async () => {
    // The API answers a failed job with the failure's own status so the
    // access log sees it. That must not look like a dropped poll.
    globalThis.fetch
      .mockResolvedValueOnce(json({ jobId: "job1", status: "queued" }, 202))
      .mockResolvedValueOnce(
        json(
          {
            jobId: "job1",
            status: "failed",
            error: "Couldn't read that receipt.",
            code: "parse_failed",
          },
          502
        )
      );

    await expect(drain(parseReceipt(PHOTO))).rejects.toMatchObject({
      code: "parse_failed",
    });
    // Two calls: the upload and one check. No retry storm on a real failure.
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("surfaces a refused photo with the code the panel branches on", async () => {
    globalThis.fetch.mockResolvedValueOnce(json({ jobId: "job1", status: "queued" }, 202)).
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
    globalThis.fetch
      .mockRejectedValueOnce(new TypeError("network"))
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(json({ jobId: "job1", status: "done", receipt: RECEIPT }));

    await expect(drain(awaitParse("job1"))).resolves.toEqual(RECEIPT);
  });

  it("gives up once the polls keep failing", async () => {
    globalThis.fetch.mockRejectedValue(new TypeError("network"));
    await expect(drain(awaitParse("job1"))).rejects.toBeInstanceOf(ApiError);
  });

  it("resuming re-attaches to the job instead of re-uploading the photo", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      json({ jobId: "job1", status: "done", receipt: RECEIPT })
    );

    await expect(drain(resumeParse("job1", PHOTO))).resolves.toEqual(RECEIPT);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch.mock.calls[0][1]?.method).toBeUndefined(); // a GET, not the upload
  });

  it("resuming a job the server has forgotten sends the photo again", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(
        json({ error: "That upload has expired.", code: "job_unknown" }, 404)
      )
      .mockResolvedValueOnce(json({ jobId: "job2", status: "queued" }, 202))
      .mockResolvedValueOnce(json({ jobId: "job2", status: "done", receipt: RECEIPT }));

    await expect(drain(resumeParse("job1", PHOTO))).resolves.toEqual(RECEIPT);
    expect(globalThis.fetch.mock.calls[1][1].method).toBe("POST");
  });
});
