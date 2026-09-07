import { Coordinate, RoadType, RoadValidationResult } from "@/types";

export interface RoadThresholdConfig {
  highway: number;
  primary: number;
  secondary: number;
  tertiary: number;
  residential: number;
  service: number;
  generic: number;
}

export const DEFAULT_ROAD_THRESHOLDS: RoadThresholdConfig = {
  highway: 100, // meters tolerance for wide dual-carriageway/toll roads
  primary: 50,
  secondary: 35,
  tertiary: 25,
  residential: 20,
  service: 15,
  generic: 30,
};

/**
 * Normalizes Indonesian street names for audit and comparison.
 * e.g. "Jl. Jendral Sudirman No. 12" -> "sudirman"
 */
export function normalizeRoadName(raw?: string): { original: string; normalized: string } {
  if (!raw) return { original: "", normalized: "" };

  const original = raw.trim();
  const normalized = original
    .toLowerCase()
    .replace(/^(jalan|jln\.?|jl\.?|gang|gg\.?|lorong|lr\.?)\s+/gi, "")
    .replace(/\b(no|nomor)\.?\s*\d+[a-z]?\b/gi, "")
    .replace(/\b(rt|rw)\.?\s*\d+\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

  return { original, normalized };
}

/**
 * Calculates Dice's Bigram Similarity Coefficient between two strings (0.0 to 1.0)
 */
export function calculateStringSimilarity(s1: string, s2: string): number {
  if (!s1 && !s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1 === s2) return 1.0;

  if (s1.length < 2 || s2.length < 2) {
    return s1.includes(s2) || s2.includes(s1) ? 0.8 : 0.0;
  }

  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);

  let intersection = 0;
  for (const [key, count] of b1.entries()) {
    if (b2.has(key)) {
      intersection += Math.min(count, b2.get(key)!);
    }
  }

  return (2.0 * intersection) / (s1.length - 1 + s2.length - 1);
}

/**
 * Great-circle distance using Haversine formula (in meters)
 */
export function haversineDistanceMeters(c1: Coordinate, c2: Coordinate): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLon = ((c2.lon - c1.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Validate road/street from Nominatim against expected road
 */
export function validateRoadLevel(
  coord: Coordinate,
  nominatimRoad?: string,
  expectedRoad?: string,
  roadType: RoadType = "residential",
  thresholds: RoadThresholdConfig = DEFAULT_ROAD_THRESHOLDS
): RoadValidationResult {
  if (!nominatimRoad && !expectedRoad) {
    return {
      available: false,
      reason: "NO_ROAD_DATA_IN_INPUT",
      distanceMeter: 0,
      thresholdMeter: thresholds[roadType] || thresholds.generic,
      nameSimilarity: 1.0,
      roadType,
      match: true,
    };
  }

  const normNom = normalizeRoadName(nominatimRoad);
  const normExp = normalizeRoadName(expectedRoad);

  const threshold = thresholds[roadType] || thresholds.generic;
  const nameSimilarity = calculateStringSimilarity(normNom.normalized, normExp.normalized);

  // When Nominatim road is missing but expected exists:
  if (!nominatimRoad && expectedRoad) {
    return {
      available: true,
      nominatimRoad: "",
      matchedRoad: expectedRoad,
      distanceMeter: 0,
      thresholdMeter: threshold,
      nameSimilarity: 0,
      roadType,
      match: false,
      errorType: "WRONG_ROAD",
    };
  }

  // When expected road is provided, compare similarity
  if (expectedRoad) {
    const isNameMatch = nameSimilarity >= 0.75;
    return {
      available: true,
      nominatimRoad,
      matchedRoad: expectedRoad,
      distanceMeter: 0, // In offline/direct check, distance is 0 unless road geometry geometry coordinates are supplied
      thresholdMeter: threshold,
      nameSimilarity: Math.round(nameSimilarity * 100) / 100,
      roadType,
      match: isNameMatch,
      errorType: isNameMatch ? undefined : "ROAD_NAME_MISMATCH",
    };
  }

  // If only Nominatim has road and no ground-truth expected road:
  return {
    available: true,
    nominatimRoad,
    matchedRoad: nominatimRoad,
    distanceMeter: 0,
    thresholdMeter: threshold,
    nameSimilarity: 1.0,
    roadType,
    match: true,
  };
}
