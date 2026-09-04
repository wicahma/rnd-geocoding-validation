import { NextRequest, NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/nominatim";
import { ISO3166_SUBDIVISIONS } from "@/types/iso3166";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coordinate } = body as { coordinate: { lat: number; lon: number } };

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

    const nominatimResult = await reverseGeocode(coordinate);

    // Propinsi tidak tersedia di NominatimAddress (state = "-" untuk DIY karena
    // kode ISO3166-2 berbeda) — isi manual dari lookup.
    const state =
      (nominatimResult.state !== "-" && nominatimResult.state) ||
      ISO3166_SUBDIVISIONS.find((s) => s.code === "ID-YO")?.name ||
      "Daerah Istimewa Yogyakarta";

    return NextResponse.json({
      coordinate,
      reverseGeocoded: { ...nominatimResult, state },
    });
  } catch (error) {
    console.error("Manual nominatim error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Nominatim check failed",
      },
      { status: 500 },
    );
  }
}
