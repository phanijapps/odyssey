import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRead } from "../../../../server/identity/identity";
import { listGoldRecords, getGoldStats, getGoldTopics } from "@odyssey/db";

/** Returns Gold records with optional filters, plus aggregate stats and topics. */
export function GET(request: NextRequest): NextResponse {
  try {
    requireAdminRead(request);
  } catch {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }
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
