import { NextResponse } from "next/server";
import { getCorrectionLogs, getVerifiedAssets } from "@/lib/storage";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "verified") {
      const records = await getVerifiedAssets();
      return NextResponse.json(records);
    }

    const records = await getCorrectionLogs();
    return NextResponse.json(records);
  } catch (error) {
    console.error("Corrections error:", error);
    return NextResponse.json({ error: "Failed to fetch records" }, { status: 500 });
  }
}
