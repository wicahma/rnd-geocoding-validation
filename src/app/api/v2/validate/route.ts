import { NextRequest, NextResponse } from "next/server";
import { Coordinate, ExpectedAddress } from "@/types";
import { reverseGeocode } from "@/lib/nominatim";
import { executeEnhancedPipeline } from "@/lib/engine/decision";
import { saveRecord } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coordinate, expected, options } = body as {
      coordinate: Coordinate;
      expected?: ExpectedAddress;
      options?: {
        enableGIS?: boolean;
        enableRoad?: boolean;
        enableAIArbitration?: boolean;
      };
    };

    if (
      !coordinate ||
      typeof coordinate.lat !== "number" ||
      typeof coordinate.lon !== "number"
    ) {
      return NextResponse.json(
        { error: "Invalid coordinate: lat & lon required" },
        { status: 400 }
      );
    }

    console.log(
      `[api/v2/validate] Start pipeline v2: coord=${coordinate.lat},${coordinate.lon}`
    );

    // 1. Fetch reverse geocode (Nominatim / Berijalan)
    const nominatimResult = await reverseGeocode(coordinate);

    // 2. Execute Hierarchical Decision Pipeline:
    // GIS (deterministic) -> Road (deterministic) -> Semantic AI
    const record = await executeEnhancedPipeline(
      coordinate,
      nominatimResult,
      expected,
      options
    );

    // 3. Persist record with full traceable evidence
    await saveRecord(record);

    console.log(
      `[api/v2/validate] Completed v2: id=${record.id}, status=${record.aiValidation.status}`
    );

    return NextResponse.json(record);
  } catch (error) {
    console.error("[api/v2/validate] Execution failure:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Pipeline execution failed",
        status: "UNAVAILABLE",
      },
      { status: 500 }
    );
  }
}
