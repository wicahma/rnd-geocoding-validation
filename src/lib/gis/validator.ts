import { Coordinate, GISAdminHierarchy, GISLevelComparison, GISValidationResult, NominatimAddress } from "@/types";
import { PROVINSI } from "@/lib/kecamatan";
import { INDONESIA_PROVINCES } from "@/lib/sampler";

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
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Normalizes string for boundary comparison (e.g. "Kota Yogyakarta" vs "Yogyakarta")
 */
export function normalizeAdminName(name?: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\b(daerah|khusus|ibukota|dki|di)\b/gi, "")
    .replace(/^(provinsi|prov\.?|kabupaten|kab\.?|kota|kecamatan|kec\.?|desa|kelurahan|kel\.?)\s+/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Resolve administrative hierarchy from coordinate using bounding boxes & regional data
 */
export function lookupGISBoundary(
  coord: Coordinate,
  mapping: GISAttributeMapping = DEFAULT_GIS_MAPPING
): GISAdminHierarchy | null {
  const { lat, lon } = coord;

  // 1. Check province bounds
  const matchedProv = INDONESIA_PROVINCES.find((p) => {
    const [minLat, minLon, maxLat, maxLon] = p.bounds;
    return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
  });

  if (!matchedProv) return null;

  const provItem = PROVINSI.find(
    (p) => normalizeAdminName(p.nama) === normalizeAdminName(matchedProv.name)
  );

  return {
    province: matchedProv.name,
    source: "indonesia_bps_bounds_v1",
    datasetVersion: "2026.1",
    boundaryIdentifiers: {
      provinceCode: provItem?.kode,
    },
  };
}

/**
 * Validate Nominatim address against GIS deterministic hierarchy
 */
export function validateAgainstGIS(
  coord: Coordinate,
  nominatim: NominatimAddress,
  expectedHierarchy?: Partial<GISAdminHierarchy>
): GISValidationResult {
  const gisData = lookupGISBoundary(coord);

  if (!gisData && !expectedHierarchy) {
    return {
      available: false,
      reason: "COORDINATE_OUTSIDE_COVERAGE_OR_DATASET_UNAVAILABLE",
      comparisons: [],
      matchedLevelsCount: 0,
      allMatched: false,
    };
  }

  const effectiveGIS: GISAdminHierarchy = {
    province: expectedHierarchy?.province || gisData?.province,
    city: expectedHierarchy?.city || gisData?.city,
    district: expectedHierarchy?.district || gisData?.district,
    village: expectedHierarchy?.village || gisData?.village,
    source: gisData?.source || "manual_shapefile_overlay",
    datasetVersion: gisData?.datasetVersion || "2026.1",
  };

  const comparisons: GISLevelComparison[] = [];

  // Check Province
  if (effectiveGIS.province) {
    const nomProv = nominatim.state || "";
    const match =
      normalizeAdminName(nomProv) === normalizeAdminName(effectiveGIS.province) ||
      (nomProv.length > 0 && effectiveGIS.province.toLowerCase().includes(nomProv.toLowerCase())) ||
      (nomProv.length > 0 && nomProv.toLowerCase().includes(effectiveGIS.province.toLowerCase()));

    comparisons.push({
      level: "province",
      nominatimValue: nomProv,
      gisValue: effectiveGIS.province,
      match,
      source: "gis",
      confidence: "deterministic",
    });
  }

  // Check City/Kabupaten
  if (effectiveGIS.city) {
    const nomCity = nominatim.city || "";
    const match =
      normalizeAdminName(nomCity) === normalizeAdminName(effectiveGIS.city);

    comparisons.push({
      level: "city",
      nominatimValue: nomCity,
      gisValue: effectiveGIS.city,
      match,
      source: "gis",
      confidence: "deterministic",
    });
  }

  // Check District/Kecamatan
  if (effectiveGIS.district) {
    const nomDistrict = nominatim.district || nominatim.subdistrict || "";
    const match =
      normalizeAdminName(nomDistrict) === normalizeAdminName(effectiveGIS.district);

    comparisons.push({
      level: "district",
      nominatimValue: nomDistrict,
      gisValue: effectiveGIS.district,
      match,
      source: "gis",
      confidence: "deterministic",
    });
  }

  // Check Village/Kelurahan
  if (effectiveGIS.village) {
    const nomVillage = nominatim.village || "";
    const match =
      normalizeAdminName(nomVillage) === normalizeAdminName(effectiveGIS.village);

    comparisons.push({
      level: "village",
      nominatimValue: nomVillage,
      gisValue: effectiveGIS.village,
      match,
      source: "gis",
      confidence: "deterministic",
    });
  }

  const matchedCount = comparisons.filter((c) => c.match).length;
  const allMatched = comparisons.length > 0 && matchedCount === comparisons.length;

  return {
    available: true,
    source: effectiveGIS.source,
    datasetVersion: effectiveGIS.datasetVersion,
    hierarchy: effectiveGIS,
    comparisons,
    matchedLevelsCount: matchedCount,
    allMatched,
  };
}
