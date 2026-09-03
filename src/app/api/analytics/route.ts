import { NextResponse } from "next/server";
import { getQualityMetrics } from "@/lib/storage";

export async function GET() {
  try {
    const metrics = await getQualityMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
