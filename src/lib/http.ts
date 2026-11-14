import { NextResponse } from "next/server";

/** Wrap a route handler so upstream failures become a clean 502 JSON error. */
export async function jsonOrError<T>(produce: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await produce(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api]", message);
    return NextResponse.json({ error: "Upstream data source failed" }, { status: 502 });
  }
}
