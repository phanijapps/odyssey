import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../server/identity/identity";
import {
  listGoldRecords,
  getGoldStats,
  getGoldTopics,
  deleteGoldRecord,
} from "../../../../server/curriculum/gold-query";

/** Returns Gold records with optional filters, plus aggregate stats and topics. */
export function GET(request: NextRequest): NextResponse {
  const params = request.nextUrl.searchParams;
  const subject = params.get("subject") ?? undefined;
  const grade = params.get("grade") ?? undefined;
  const domain = params.get("domain") ?? undefined;
  const topic = params.get("topic") ?? undefined;
  const search = params.get("search") ?? undefined;
  const statsOnly = params.get("stats") === "1";

  if (statsOnly) {
    return NextResponse.json({
      stats: getGoldStats(),
      topics: getGoldTopics(),
    });
  }

  const records = listGoldRecords({ subject, grade, domain, topic, search });
  return NextResponse.json({
    records,
    stats: getGoldStats(),
    topics: getGoldTopics(),
  });
}

/** Deletes a single Gold record by record id. */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);
  } catch {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }
  const body = (await request.json()) as { recordId?: unknown };
  if (typeof body.recordId !== "string" || !body.recordId.trim())
    return NextResponse.json({ error: "Record id required" }, { status: 400 });
  const deleted = deleteGoldRecord(body.recordId);
  if (!deleted)
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
