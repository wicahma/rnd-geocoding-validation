import { NextRequest, NextResponse } from "next/server";
import { Coordinate, ExpectedAddress } from "@/types";
import { buildPrompt, sendToGemini } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coordinate, sourceText, expected } = body as {
      coordinate?: Coordinate;
      sourceText?: string;
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

    // Sama dengan payload pipeline: kalau sourceText kosong, bangun prompt
    // dari koordinat + expected (tanpa hasil Nominatim).
    const text =
      sourceText?.trim() ||
      buildPrompt(coordinate, { displayName: "" }, expected);

    const aiValidation = await sendToGemini({
      coord: coordinate,
      sourceText: text,
      expected,
    });

    return NextResponse.json({
      coordinate,
      prompt: text,
      aiValidation,
    });
  } catch (error) {
    console.error("Manual Gemini error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Gemini check failed",
      },
      { status: 500 },
    );
  }
}
