/**
 * Backend calls.
 *
 * The old client polled /healthcheck every 2.5s for up to two minutes before
 * every parse, to wake a sleeping free-tier backend. The server is always on
 * now, so that whole loop is gone — it only ever added latency and a second
 * way to fail. If the API really is down, the upload itself says so.
 *
 * Reading a receipt no longer happens inside the upload request. Uploading
 * starts a job and returns a job id straight away; we then ask how it is
 * going about once a second. That is what lets the wait show real progress,
 * and what stops a phone that slept mid-parse from losing a receipt the
 * server had already read.
 *
 * In production Caddy serves the UI and proxies /api on the same hostname, so
 * the default base is a relative path: no CORS, no preflight, nothing to
 * configure. VITE_API_BASE_URL exists only for split-origin local dev.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

const POLL_INTERVAL_MS = 1000;
// Nothing should take this long. It is a backstop against polling forever if
// the server somehow leaves a job running, not a parse deadline.
const POLL_CEILING_MS = 5 * 60 * 1000;

/** Errors carrying a code the UI can react to, rather than a bare string. */
export class ApiError extends Error {
  constructor(message, { code = "unknown", status = 0 } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/** A response body, or null if there wasn't one we could read. */
async function readBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readError(response, body) {
  // The API always returns JSON errors now, but a proxy or gateway in front
  // of it might not, so this must never throw while handling a failure.
  if (body && typeof body.error === "string") {
    return new ApiError(body.error, { code: body.code, status: response.status });
  }
  if (response.status === 413) {
    return new ApiError("That photo is too large. Try a smaller one.", {
      code: "too_large",
      status: 413,
    });
  }
  if (response.status === 429) {
    return new ApiError("Too many receipts just now. Wait a minute and retry.", {
      code: "rate_limited",
      status: 429,
    });
  }
  return new ApiError("The server had a problem reading that receipt.", {
    code: "server_error",
    status: response.status,
  });
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });

/**
 * Hand the photo over and get back the id of the job now reading it.
 * Returns the server's first progress snapshot.
 */
export async function startParse(file, { signal, jobId } = {}) {
  const form = new FormData();
  form.append("image", file);
  if (jobId) form.append("jobId", jobId);

  const path = jobId
    ? `${BASE}/parse-receipt/${encodeURIComponent(jobId)}`
    : `${BASE}/parse-receipt`;

  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      body: form,
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError(
      "Couldn't reach the server. Check your connection and try again.",
      { code: "network" }
    );
  }

  const body = await readBody(response);
  if (!response.ok) throw readError(response, body);
  return body;
}

/**
 * One progress check.
 *
 * A failed parse answers with the failure's own status code rather than 200,
 * so that the access log behind /stats can see that the job went wrong. That
 * is a reporting concern, not a transport one: the body is a normal progress
 * snapshot either way, and a snapshot is an answer, not a dropped call. Only
 * a reply that isn't one — a gateway's HTML, a 404 for a job the server has
 * forgotten — is thrown.
 */
export async function checkParse(jobId, { signal } = {}) {
  const response = await fetch(`${BASE}/parse-receipt/${encodeURIComponent(jobId)}`, {
    signal,
  });
  const body = await readBody(response);
  if (body && typeof body.status === "string") return body;
  throw readError(response, body);
}

/**
 * Watch a job until it finishes, reporting progress as it goes.
 *
 * A failed poll is not a failed parse — a phone changing networks drops one
 * request while the server carries on — so transient poll errors are ridden
 * out and only reported if they persist.
 *
 * @param {string} jobId
 * @param {{signal?: AbortSignal, onProgress?: (snapshot) => void}} opts
 * @returns the parsed receipt
 */
export async function awaitParse(jobId, { signal, onProgress } = {}) {
  const giveUpAt = Date.now() + POLL_CEILING_MS;
  let consecutiveFailures = 0;

  for (;;) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    let snapshot;
    try {
      snapshot = await checkParse(jobId, { signal });
      consecutiveFailures = 0;
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      // The server forgetting the job is final — no amount of asking again
      // will bring it back, and the photo needs sending afresh.
      if (err instanceof ApiError && err.code === "job_unknown") throw err;
      if ((consecutiveFailures += 1) >= 5) {
        throw err instanceof ApiError
          ? err
          : new ApiError("Lost contact with the server while reading that receipt.", {
              code: "network",
            });
      }
      await sleep(POLL_INTERVAL_MS, signal);
      continue;
    }

    onProgress?.(snapshot);

    if (snapshot.status === "done") return snapshot.receipt;
    if (snapshot.status === "failed") {
      throw new ApiError(snapshot.error || "Couldn't read that receipt.", {
        code: snapshot.code || "parse_failed",
      });
    }
    if (Date.now() > giveUpAt) {
      throw new ApiError(
        "That receipt is taking far longer than it should. Try again.",
        { code: "timeout" }
      );
    }
    await sleep(POLL_INTERVAL_MS, signal);
  }
}

/**
 * Send the photo and wait for the line items, narrating the wait.
 *
 * `jobId` makes the call idempotent: if the phone backgrounds the tab and the
 * connection dies, starting again with the same id attaches to the parse the
 * server is already running rather than reading the receipt twice.
 *
 * @param {File} file
 * @param {{signal?: AbortSignal, jobId?: string, onProgress?: Function}} opts
 */
export async function parseReceipt(file, { signal, jobId, onProgress } = {}) {
  const started = await startParse(file, { signal, jobId });
  onProgress?.(started);
  return awaitParse(started.jobId, { signal, onProgress });
}

/**
 * Pick up a job started before the tab was suspended, without re-uploading.
 * Falls back to sending the photo again if the server has forgotten it.
 */
export async function resumeParse(jobId, file, { signal, onProgress } = {}) {
  try {
    return await awaitParse(jobId, { signal, onProgress });
  } catch (err) {
    if (err instanceof ApiError && err.code === "job_unknown" && file) {
      return parseReceipt(file, { signal, jobId, onProgress });
    }
    throw err;
  }
}

export async function health() {
  const response = await fetch(`${BASE}/healthz`);
  return response.json();
}
