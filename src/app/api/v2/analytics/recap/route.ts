import { NextRequest, NextResponse } from "next/server";
import {
  generateProvinceAIRecap,
  getProvinceAggregates,
} from "@/lib/analytics/recap";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get("province");

    const aggregates = await getProvinceAggregates(province || undefined);

    let recap = null;
    if (province) {
      recap = await generateProvinceAIRecap(province);
    }

    return NextResponse.json({
      aggregates,
      recap,
      count: aggregates.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/v2/analytics/recap] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate province quality aggregates" },
      { status: 500 }
    );
  }
}
