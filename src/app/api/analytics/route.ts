import { NextResponse } from "next/server";
import { getQualityMetrics } from "@/lib/storage";

export async function GET() {
  console.log("[api/analytics] GET metrics requested");
  try {
    const metrics = await getQualityMetrics();
    console.log(
      `[api/analytics] Returning metrics: total=${metrics.totalTested}, valid=${metrics.valid}, needReview=${metrics.needReview}`,
    );
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("[api/analytics] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 },
    );
  }
}
