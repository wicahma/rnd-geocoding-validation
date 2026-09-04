import { NextResponse } from "next/server";
import { getCorrectionLogs, getVerifiedAssets } from "@/lib/storage";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    console.log(`[api/corrections] GET requested (type=${type || "logs"})`);

    if (type === "verified") {
      const records = await getVerifiedAssets();
      console.log(
        `[api/corrections] Returning ${records.length} verified asset(s)`,
      );
      return NextResponse.json(records);
    }

    const records = await getCorrectionLogs();
    console.log(
      `[api/corrections] Returning ${records.length} correction log(s)`,
    );
    return NextResponse.json(records);
  } catch (error) {
    console.error("[api/corrections] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch records" },
      { status: 500 },
    );
  }
}
