import { NextRequest, NextResponse } from "next/server";
import { Coordinate, ExpectedAddress, ValidationRecord } from "@/types";
import { reverseGeocode } from "@/lib/nominatim";
import { validateWithGemini } from "@/lib/gemini";
import { saveBatchRecords } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coordinates, expected } = body as {
      coordinates: Coordinate[];
      expected?: ExpectedAddress;
    };

    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return NextResponse.json(
        { error: "Invalid coordinates array" },
        { status: 400 },
      );
    }

    if (coordinates.length > 50) {
      return NextResponse.json(
        {
          error:
            "Max 50 coordinates per batch (respects Nominatim rate limits)",
        },
        { status: 400 },
      );
    }

    console.log(
      `[api/validate/batch] POST received: ${coordinates.length} coordinate(s)`,
    );

    const records: ValidationRecord[] = [];

    for (let i = 0; i < coordinates.length; i++) {
      const coordinate = coordinates[i];
      if (
        typeof coordinate.lat !== "number" ||
        typeof coordinate.lon !== "number"
      ) {
        console.warn(
          `[api/validate/batch] Skipping invalid coordinate at index ${i}`,
        );
        continue;
      }
      console.log(
        `[api/validate/batch] Processing coordinate ${i + 1}/${coordinates.length}: ${coordinate.lat},${coordinate.lon}`,
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
      records.push(record);
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }

    await saveBatchRecords(records);
    console.log(
      `[api/validate/batch] Completed: processed ${records.length}/${coordinates.length}`,
    );

    return NextResponse.json({
      processed: records.length,
      records,
    });
  } catch (error) {
    console.error("Batch validation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Batch validation failed",
      },
      { status: 500 },
    );
  }
}
