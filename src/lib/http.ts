import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "./permissions";
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, max = 60) {
  const now = Date.now();
  if (buckets.size > 10000)
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  const v = buckets.get(key);
  if (!v || v.reset < now) {
    buckets.set(key, { count: 1, reset: now + 60000 });
    return;
  }
  if (v.count >= max)
    throw new DomainError(
      "Too many requests. Please try again in a minute.",
      429,
    );
  v.count++;
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = new URL(process.env.APP_URL ?? req.url).origin;
  if (origin !== expected)
    throw new DomainError("Request origin is not allowed.", 403);
}
export async function jsonBody(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > 64000)
    throw new DomainError("Request is too large.", 413);
  const body = await req.text();
  if (body.length > 64000) throw new DomainError("Request is too large.", 413);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new DomainError("Invalid JSON.");
  }
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  if (error instanceof DomainError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  console.error(
    "[Probe] Request failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
