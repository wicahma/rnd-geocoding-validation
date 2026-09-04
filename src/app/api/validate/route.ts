import { NextRequest, NextResponse } from "next/server";
import { Coordinate, ExpectedAddress, ValidationRecord } from "@/types";
import { reverseGeocode } from "@/lib/nominatim";
import { validateWithGemini } from "@/lib/gemini";
import { saveRecord } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coordinate, expected } = body as {
      coordinate: Coordinate;
      expected?: ExpectedAddress;
    };

    if (
      !coordinate ||
      typeof coordinate.lat !== "number" ||
      typeof coordinate.lon !== "number"
    ) {
      return NextResponse.json(
        { error: "Invalid coordinate" },
        { status: 400 },
      );
    }

    console.log(
      `[api/validate] POST received: coord=${coordinate.lat},${coordinate.lon}, expected=${expected ? "yes" : "no"}`,
    );

    const nominatimResult = await reverseGeocode(coordinate);
    const aiValidation = await validateWithGemini(
      coordinate,
      nominatimResult,
      expected,
    );

    const record: ValidationRecord = {
      id: crypto.randomUUID(),
      coordinate,
      nominatimResult,
      expectedAddress: expected,
      aiValidation,
      testedAt: new Date().toISOString(),
    };

    await saveRecord(record);
    console.log(
      `[api/validate] Completed: id=${record.id}, status=${record.aiValidation.status}, confidence=${record.aiValidation.confidenceScore}`,
    );

    return NextResponse.json(record);
  } catch (error) {
    console.error("Validation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Validation failed" },
      { status: 500 },
    );
  }
}
