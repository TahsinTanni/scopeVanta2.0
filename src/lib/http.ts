import { NextResponse } from "next/server";

// Mirrors legacy `json()` / `error()` from @appdeploy/sdk so route bodies
// stay close to the legacy shape during translation.
export function json<T>(data: T, status = 200) {
  return NextResponse.json(data as object, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Wraps a route handler so a thrown HttpError becomes the right JSON error response. */
export function withErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof HttpError) return error(e.message, e.status);
      console.error(e);
      return error("Unexpected server error.", 500);
    }
  };
}
