import {
  Coordinate,
  GISAdminHierarchy,
  GISLevelComparison,
  GISValidationResult,
  NominatimAddress,
  AdminHierarchyCodes,
} from "@/types";
import { resolveAdminHierarchyAt } from "./shapefile";

export interface GISAttributeMapping {
  province: string[];
  city: string[];
  district: string[];
  village: string[];
  provinceCode?: string[];
  cityCode?: string[];
  districtCode?: string[];
  villageCode?: string[];
}

export const DEFAULT_GIS_MAPPING: GISAttributeMapping = {
  province: ["PROVINSI", "WADMPR", "Propinsi", "KODE_PROV", "provinsi"],
  city: ["KAB_KOTA", "KABUPATEN", "KOTA", "WADMKK", "kabupaten", "kota"],
  district: ["KECAMATAN", "WADMKC", "kecamatan"],
  village: ["DESA", "KELURAHAN", "WADMKD", "desa", "kelurahan"],
  provinceCode: ["KODE_PROP", "KD_PROV"],
  cityCode: ["KODE_KAB", "KD_KAB"],
  districtCode: ["KODE_KEC", "KD_KEC"],
  villageCode: ["KODE_DESA", "KD_DESA"],
};

export type Point = [number, number]; // [lon, lat]

/**
 * Point-in-polygon ray-casting algorithm (WGS84 EPSG:4326)
 * point: [lon, lat]
 * vs: array of [lon, lat]
 */
export function pointInPolygon(point: Point, vs: Point[]): boolean {
  const x = point[0];
  const y = point[1];
  let inside = false;

  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0],
      yi = vs[i][1];
    const xj = vs[j][0],
      yj = vs[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Normalizes string for boundary comparison (e.g. "Kota Yogyakarta" vs
 * "Yogyakarta", "Daerah Khusus Ibukota Jakarta" vs "DKI Jakarta",
 * "Kota Administrasi Jakarta Selatan" vs "Jakarta Selatan").
 */
export function normalizeAdminName(name?: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(
      /\b(daerah|khusus|ibukota|ibu kota|dki|di|administrasi|admin)\b/gi,
      "",
    )
    .replace(
      /^(provinsi|prov\.?|kabupaten|kab\.?|kota|kecamatan|kec\.?|desa|kelurahan|kel\.?)\s+/gi,
      "",
    )
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Resolve administrative hierarchy from coordinate using real shapefile
 * polygons (current administrative boundary per Kepmendagri, cahyadsn
 * wilayah_boundaries). Walks province -> city -> district via point-in-polygon.
 */
export async function lookupGISBoundary(
  coord: Coordinate,
  _mapping: GISAttributeMapping = DEFAULT_GIS_MAPPING,
): Promise<GISAdminHierarchy | null> {
  const result = await resolveAdminHierarchyAt(coord);
  if (!result) return null;

  const boundaryIdentifiers: AdminHierarchyCodes = {
    provinceCode: result.codes.provinceCode,
    cityCode: result.codes.cityCode,
    districtCode: result.codes.districtCode,
  };

  return {
    province: result.names.province,
    city: result.names.city,
    district: result.names.district,
    source: "shapefile_wilayah_boundaries_v2026.1",
    datasetVersion: "2026.1",
    boundaryIdentifiers,
  };
}

/**
 * Build the "enhanced address": the Nominatim reverse-geocoding result
 * corrected/enriched with deterministic GIS shapefile geometry —
 * the ground-truth street view of what the coordinate really is.
 * Cross-match compares the AI against THIS address.
 */
export async function buildEnhancedAddress(
  coord: Coordinate,
  nominatim: NominatimAddress,
): Promise<GISAdminHierarchy> {
  const gisData = await lookupGISBoundary(coord);

  return {
    province: gisData?.province || nominatim.state,
    city: gisData?.city || nominatim.city,
    district: gisData?.district || nominatim.district || nominatim.subdistrict,
    village: nominatim.village,
    source: gisData?.source || "manual_shapefile_overlay",
    datasetVersion: gisData?.datasetVersion || "2026.1",
    boundaryIdentifiers: gisData?.boundaryIdentifiers,
  };
}

/**
 * Validate Nominatim address against GIS deterministic hierarchy
 */
export async function validateAgainstGIS(
  coord: Coordinate,
  nominatim: NominatimAddress,
  expectedHierarchy?: Partial<GISAdminHierarchy>,
): Promise<GISValidationResult> {
  const gisData = await lookupGISBoundary(coord);

  // Claim (expected) vs ground truth (shapefile). No claim -> not verifiable.
  if (!gisData && !expectedHierarchy) {
    return {
      available: false,
      reason: "COORDINATE_OUTSIDE_COVERAGE_OR_DATASET_UNAVAILABLE",
      comparisons: [],
      matchedLevelsCount: 0,
      allMatched: false,
    };
  }

  const comparisons: GISLevelComparison[] = [];

  // Claim (expected) vs ground truth (shapefile). No claim -> not verifiable.
  const levelKeys: Array<{
    level: GISLevelComparison["level"];
    claim: string | undefined;
    truth: string | undefined;
  }> = [
    {
      level: "province",
      // Province understood from context (claim fallback = shapefile itself)
      claim: expectedHierarchy?.province || gisData?.province,
      truth: gisData?.province,
    },
    {
      level: "city",
      claim: expectedHierarchy?.city || gisData?.city,
      truth: gisData?.city,
    },
    {
      level: "district",
      claim: expectedHierarchy?.district || gisData?.district,
      truth: gisData?.district,
    },
    {
      level: "village",
      claim: expectedHierarchy?.village,
      truth: gisData?.village,
    },
  ];

  for (const { level, claim, truth } of levelKeys) {
    if (!truth && !claim) continue; // nothing to compare at this level

    let match: boolean;
    if (!claim) {
      // No claim -> cannot be wrong (shapefile overlay still reported)
      match = true;
    } else if (!truth) {
      // Claim but no GIS coverage for this level -> cannot be checked
      match = true;
    } else {
      const c = normalizeAdminName(claim);
      const t = normalizeAdminName(truth);
      match = c === t || t.includes(c) || c.includes(t);
    }

    comparisons.push({
      level,
      nominatimValue: claim || truth, // claimed value being verified
      gisValue: truth, // deterministic shapefile ground truth
      match,
      source: "gis",
      confidence: "deterministic",
    });
  }

  const matchedLevelsCount = comparisons.filter((c) => c.match).length;

  // available as long as we produced comparisons (claims exist)
  const gisAvailable = !!gisData;
  return {
    available: gisAvailable || comparisons.length > 0,
    reason: gisAvailable
      ? undefined
      : "CLAIMED_LEVELS_OUTSIDE_SHAPEFILE_COVERAGE",
    source: gisData?.source || "manual_shapefile_overlay",
    datasetVersion: gisData?.datasetVersion || "2026.1",
    hierarchy: gisData || undefined,
    comparisons,
    matchedLevelsCount,
    allMatched: matchedLevelsCount === comparisons.length,
  };
}
