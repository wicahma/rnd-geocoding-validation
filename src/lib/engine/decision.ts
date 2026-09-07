import {
  Coordinate,
  ErrorType,
  ExpectedAddress,
  NominatimAddress,
  ValidationEvidence,
  ValidationRecord,
  ValidationStatus,
} from "@/types";
import { validateAgainstGIS } from "@/lib/gis/validator";
import { validateRoadLevel } from "@/lib/road/validator";
import { validateWithGemini } from "@/lib/gemini";

export interface DecisionEngineOptions {
  enableGIS?: boolean;
  enableRoad?: boolean;
  enableAIArbitration?: boolean;
  berijalanOnly?: boolean;
}

/**
 * Enhanced Validation Decision Engine:
 * Strictly follows deterministic hierarchy:
 * 1. GIS Boundary Validator (ground truth for admin levels)
 * 2. Road Validator (street name & geometry/distance match)
 * 3. Deterministic comparison
 * 4. AI (Gemini) ONLY for semantic arbitration / ambiguity
 */
export async function executeEnhancedPipeline(
  coordinate: Coordinate,
  nominatimResult: NominatimAddress,
  expected?: ExpectedAddress,
  options: DecisionEngineOptions = {}
): Promise<ValidationRecord> {
  const {
    enableGIS = true,
    enableRoad = true,
    enableAIArbitration = true,
  } = options;

  const errors: ErrorType[] = [];
  const validationId = crypto.randomUUID();

  // 1. GIS Validation (Deterministic)
  const gisValidation = enableGIS
    ? validateAgainstGIS(coordinate, nominatimResult, {
        province: expected?.province,
        city: expected?.city,
        district: expected?.district,
        village: expected?.village,
      })
    : {
        available: false,
        reason: "GIS_VALIDATION_DISABLED",
        comparisons: [],
        matchedLevelsCount: 0,
        allMatched: false,
      };

  // Check deterministic GIS mismatches
  if (gisValidation.available) {
    for (const comp of gisValidation.comparisons) {
      if (!comp.match) {
        if (comp.level === "province") errors.push("WRONG_PROVINCE");
        if (comp.level === "city") errors.push("WRONG_CITY");
        if (comp.level === "district") errors.push("WRONG_DISTRICT");
        if (comp.level === "village") errors.push("WRONG_VILLAGE");
      }
    }
  }

  // 2. Road Validation (Deterministic)
  const roadValidation = enableRoad
    ? validateRoadLevel(coordinate, nominatimResult.road, expected?.road)
    : {
        available: false,
        reason: "ROAD_VALIDATION_DISABLED",
        distanceMeter: 0,
        thresholdMeter: 20,
        nameSimilarity: 1.0,
        roadType: "generic" as const,
        match: true,
      };

  if (roadValidation.available && !roadValidation.match) {
    if (roadValidation.errorType) {
      errors.push(roadValidation.errorType);
    } else {
      errors.push("WRONG_ROAD");
    }
  }

  // 3. Deterministic Decision Check
  const hasDeterministicMismatch = errors.length > 0;
  let finalStatus: ValidationStatus = "VALID";
  let determinedBy: "deterministic_gis_road" | "ai_arbitration" | "fallback" =
    "deterministic_gis_road";
  let confidenceScore = 100;
  let notes = "Deterministic GIS and road validation passed.";

  // If deterministic mismatches exist, we don't need AI to guess
  if (hasDeterministicMismatch) {
    finalStatus = "INCORRECT";
    confidenceScore = Math.max(30, 95 - errors.length * 15);
    notes = `Deterministic mismatch detected: ${errors.join(", ")}.`;
  }

  // 4. AI Validation (Only when ambiguous or requested for semantic insights)
  let aiAnalysisResult = undefined;
  const isAmbiguous =
    !gisValidation.available ||
    gisValidation.comparisons.length === 0 ||
    !nominatimResult.road ||
    !nominatimResult.village;

  if (enableAIArbitration && (isAmbiguous || !hasDeterministicMismatch)) {
    try {
      const ai = await validateWithGemini(coordinate, nominatimResult, expected);
      aiAnalysisResult = ai;

      if (!hasDeterministicMismatch) {
        // If GIS had missing levels, allow AI to suggest review
        if (ai.status === "NEED_REVIEW") {
          finalStatus = "NEED_REVIEW";
          determinedBy = "ai_arbitration";
          notes = ai.notes;
          confidenceScore = ai.confidenceScore;
          for (const err of ai.errorTypes) {
            if (!errors.includes(err)) errors.push(err);
          }
        } else if (ai.status === "INCORRECT" && !gisValidation.available) {
          finalStatus = "INCORRECT";
          determinedBy = "ai_arbitration";
          notes = ai.notes;
          confidenceScore = ai.confidenceScore;
          for (const err of ai.errorTypes) {
            if (!errors.includes(err)) errors.push(err);
          }
        }
      }
    } catch (err) {
      console.warn("[engine] AI arbitration failed gracefully:", err);
    }
  }

  const uniqueErrors = Array.from(new Set(errors));

  const evidence: ValidationEvidence = {
    validationId,
    coordinate,
    nominatim: {
      source: "nominatim",
      data: nominatimResult,
    },
    gisValidation,
    roadValidation,
    aiValidation: aiAnalysisResult
      ? {
          source: "gemini",
          invoked: true,
          analysis: aiAnalysisResult,
        }
      : undefined,
    finalDecision: {
      status: finalStatus,
      determinedBy,
      confidenceScore,
      errorTypes: uniqueErrors,
      reason: notes,
    },
    timestamp: new Date().toISOString(),
  };

  const record: ValidationRecord = {
    id: validationId,
    coordinate,
    nominatimResult,
    expectedAddress: expected,
    aiValidation: {
      isValid: finalStatus === "VALID",
      status: finalStatus,
      confidenceScore,
      errorTypes: uniqueErrors,
      hierarchyConsistent: !uniqueErrors.includes("WRONG_HIERARCHY") && !uniqueErrors.includes("WRONG_CITY") && !uniqueErrors.includes("WRONG_PROVINCE"),
      notes,
      expectedAddress: expected || {
        road: nominatimResult.road,
        village: nominatimResult.village,
        district: nominatimResult.district,
        city: nominatimResult.city,
        province: nominatimResult.state,
        postcode: nominatimResult.postcode,
      },
    },
    testedAt: evidence.timestamp,
    provinceTarget: expected?.province || nominatimResult.state,
    evidence,
  };

  return record;
}
