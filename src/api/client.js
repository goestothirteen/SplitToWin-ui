/**
 * Backend calls.
 *
 * The old client polled /healthcheck every 2.5s for up to two minutes before
 * every parse, to wake a sleeping free-tier backend. The server is always on
 * now, so that whole loop is gone — it only ever added latency and a second
 * way to fail. If the API really is down, the upload itself says so.
 *
 * In production Caddy serves the UI and proxies /api on the same hostname, so
 * the default base is a relative path: no CORS, no preflight, nothing to
 * configure. VITE_API_BASE_URL exists only for split-origin local dev.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

/** Errors carrying a code the UI can react to, rather than a bare string. */
export class ApiError extends Error {
  constructor(message, { code = "unknown", status = 0 } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function readError(response) {
  // The API always returns JSON errors now, but a proxy or gateway in front
  // of it might not, so this must never throw while handling a failure.
  try {
    const body = await response.json();
    if (body && typeof body.error === "string") {
      return new ApiError(body.error, { code: body.code, status: response.status });
    }
  } catch {
    /* fall through */
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

/**
 * Send the photo and get back structured line items.
 *
 * `jobId` makes the call idempotent: if the phone backgrounds the tab and the
 * connection dies, retrying with the same id returns the result the server
 * already computed rather than reading the receipt again.
 *
 * @param {File} file
 * @param {{signal?: AbortSignal, jobId?: string}} opts
 */
export async function parseReceipt(file, { signal, jobId } = {}) {
  const form = new FormData();
  form.append("image", file);
  if (jobId) form.append("jobId", jobId);

  let response;
  try {
    response = await fetch(`${BASE}/parse-receipt`, {
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

  if (!response.ok) throw await readError(response);

  try {
    return await response.json();
  } catch {
    throw new ApiError("The server sent back something unreadable.", {
      code: "bad_response",
      status: response.status,
    });
  }
}

export async function health() {
  const response = await fetch(`${BASE}/healthz`);
  return response.json();
}
