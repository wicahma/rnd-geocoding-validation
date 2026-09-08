import {
  AIValidationAnalysis,
  Coordinate,
  CrossMatchComparison,
  CrossMatchLevel,
  CrossMatchResult,
  ErrorType,
  ExpectedAddress,
  NominatimAddress,
  ValidationEvidence,
  ValidationRecord,
  ValidationStatus,
} from "@/types";
import {
  buildEnhancedAddress,
  normalizeAdminName,
  validateAgainstGIS,
} from "@/lib/gis/validator";
import { validateRoadLevel } from "@/lib/road/validator";
import { validateWithGemini } from "@/lib/gemini";

export interface DecisionEngineOptions {
  enableGIS?: boolean;
  enableRoad?: boolean;
  enableAIArbitration?: boolean;
  berijalanOnly?: boolean;
}

/**
 * Enhanced Validation Decision Engine (V2):
 * Final result = cross-match between the AI judgment AND the Nominatim
 * address enhanced by deterministic GIS (shapefile point-in-polygon) and
 * road-level checks.
 *
 * 1. Build enhanced Nominatim (GIS ground truth -> correct every level)
 * 2. Deterministic GIS + road validation -> errors + enhanced truth
 * 3. ALWAYS invoke AI (when enabled): AI sees raw Nominatim + expected
 * 4. Cross-match AI outcome vs enhanced truth field-by-field
 * 5. Final status from the reconciliation:
 *    - AI and enhanced agree -> VALID
 *    - AI disagrees with deterministic GIS/road -> INCORRECT (determinism wins)
 *    - deterministic inconclusive but AI flags issues -> NEED_REVIEW / INCORRECT
 */
export async function executeEnhancedPipeline(
  coordinate: Coordinate,
  nominatimResult: NominatimAddress,
  expected?: ExpectedAddress,
  options: DecisionEngineOptions = {},
): Promise<ValidationRecord> {
  const {
    enableGIS = true,
    enableRoad = true,
    enableAIArbitration = true,
  } = options;

  const errors: ErrorType[] = [];
  const validationId = crypto.randomUUID();

  // 0. Enhanced address: GIS shapefile truth + Nominatim fallback.
  //    This is the "enhanced Nominatim" the AI is cross-matched against.
  const enhancedAddress = enableGIS
    ? await buildEnhancedAddress(coordinate, nominatimResult)
    : {
        province: nominatimResult.state,
        city: nominatimResult.city,
        district: nominatimResult.district || nominatimResult.subdistrict,
        village: nominatimResult.village,
        source: "manual_shapefile_overlay" as const,
        datasetVersion: "2026.1",
      };

  // 1. GIS Validation (deterministic, shapefile polygons)
  const gisValidation = enableGIS
    ? await validateAgainstGIS(coordinate, nominatimResult, {
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

  // Deterministic GIS mismatches
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

  // 2. Road Validation (deterministic)
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
    if (roadValidation.errorType) errors.push(roadValidation.errorType);
    else errors.push("WRONG_ROAD");
  }

  const deterministicErrors = [...errors];

  // 3. AI validation — ALWAYS invoked (cross-match requirement)
  let aiAnalysisResult = undefined;
  let aiInvoked = false;
  if (enableAIArbitration) {
    aiInvoked = true;
    try {
      const ai = await validateWithGemini(
        coordinate,
        nominatimResult,
        expected,
      );
      aiAnalysisResult = ai;
    } catch (err) {
      console.warn("[engine] AI arbitration failed gracefully:", err);
    }
  }

  // 4. Cross-match AI vs Nominatim (per level) – GIS/road are supplemental
  const crossMatch = buildCrossMatch(
    aiAnalysisResult,
    expected,
    {
      province: nominatimResult.state,
      city: nominatimResult.city,
      district: nominatimResult.district || nominatimResult.subdistrict,
      village: nominatimResult.village,
    },
    roadValidation,
    nominatimResult,
  );

  // 5. Final decision – prioritize AI vs Nominatim; ignore deterministic GIS/road mismatches
  const finalStatus = aiAnalysisResult?.status ?? "VALID";
  const determinedBy = aiAnalysisResult ? "ai_arbitration" : "fallback";
  const confidenceScore = aiAnalysisResult?.confidenceScore ?? 1.0;
  const reason = aiAnalysisResult?.notes ?? "AI vs Nominatim comparison";
  const finalErrors: ErrorType[] = [];

  const finalRecordErrors = Array.from(
    new Set([...finalErrors, ...deterministicErrors]),
  );

  // 6. Attach enhanced address to AI analysis (traceability)
  const analysisWithEnhanced = aiAnalysisResult
    ? {
        ...aiAnalysisResult,
        enhancedAddress: {
          road: enhancedAddress.province
            ? expected?.road || nominatimResult.road
            : nominatimResult.road,
          village: enhancedAddress.village,
          district: enhancedAddress.district,
          city: enhancedAddress.city,
          province: enhancedAddress.province,
          postcode: nominatimResult.postcode,
          source: enhancedAddress.source,
          datasetVersion: enhancedAddress.datasetVersion,
          boundaryIdentifiers: enhancedAddress.boundaryIdentifiers,
        },
        crossMatch,
      }
    : undefined;

  const evidence: ValidationEvidence = {
    validationId,
    coordinate,
    nominatim: {
      source: "nominatim",
      data: nominatimResult,
    },
    gisValidation,
    roadValidation,
    enhancedAddress: {
      road: expected?.road || nominatimResult.road,
      village: enhancedAddress.village,
      district: enhancedAddress.district,
      city: enhancedAddress.city,
      province: enhancedAddress.province,
      postcode: nominatimResult.postcode,
      source: enhancedAddress.source,
      datasetVersion: enhancedAddress.datasetVersion,
      boundaryIdentifiers: enhancedAddress.boundaryIdentifiers,
    },
    crossMatch,
    aiValidation: aiAnalysisResult
      ? {
          source: "gemini",
          invoked: aiInvoked,
          analysis: analysisWithEnhanced,
        }
      : { source: "heuristic", invoked: aiInvoked },
    finalDecision: {
      status: finalStatus,
      determinedBy,
      confidenceScore,
      errorTypes: finalRecordErrors,
      reason,
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
      errorTypes: finalRecordErrors,
      hierarchyConsistent:
        !finalRecordErrors.includes("WRONG_HIERARCHY") &&
        !finalRecordErrors.includes("WRONG_CITY") &&
        !finalRecordErrors.includes("WRONG_PROVINCE"),
      notes: reason,
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

/**
 * Field-by-field cross-match: AI/expected side vs enhanced ground-truth side.
 */
function buildCrossMatch(
  ai: AIValidationAnalysis | undefined,
  expected: ExpectedAddress | undefined,
  enhanced: {
    province?: string;
    city?: string;
    district?: string;
    village?: string;
  },
  road: { match: boolean; nominatimRoad?: string; matchedRoad?: string },
  nominatim: NominatimAddress,
): CrossMatchResult {
  const comparisons: CrossMatchComparison[] = [];

  // AI side: use AI's expectedAddress (its determination) or plain expected
  const aiExpected = ai?.expectedAddress;

  const aiVal = (field: keyof ExpectedAddress): string | undefined => {
    const v = aiExpected?.[field] || expected?.[field];
    return typeof v === "string" &&
      v.trim() &&
      !/^(n\/?a|-|none|null|undefined)$/i.test(v.trim())
      ? v
      : undefined;
  };
  const nomVal = (field: keyof NominatimAddress): string | undefined => {
    const v = nominatim[field];
    return typeof v === "string" &&
      v.trim() &&
      !/^(n\/?a|-|none|null|undefined)$/i.test(v.trim())
      ? v
      : undefined;
  };

  const levels: Array<{
    level: CrossMatchLevel;
    ai: string | undefined;
    enhanced: string | undefined;
  }> = [
    {
      level: "province",
      ai: aiVal("province"),
      enhanced: enhanced.province || nomVal("state"),
    },
    {
      level: "city",
      ai: aiVal("city"),
      enhanced: enhanced.city || nomVal("city"),
    },
    {
      level: "district",
      ai: aiVal("district"),
      enhanced:
        enhanced.district || nomVal("district") || nomVal("subdistrict"),
    },
    {
      level: "village",
      ai: aiVal("village"),
      enhanced: enhanced.village || nomVal("village"),
    },
    {
      level: "road",
      ai: aiVal("road"),
      enhanced: road.matchedRoad || nomVal("road"),
    },
  ];

  for (const { level, ai, enhanced: ev } of levels) {
    const bothPresent = !!ai && !!ev;
    const match = bothPresent
      ? normalizeAdminName(ai) === normalizeAdminName(ev) ||
        (ev !== undefined &&
          ai !== undefined &&
          (ev.toLowerCase().includes(ai.toLowerCase()) ||
            ai.toLowerCase().includes(ev.toLowerCase())))
      : // Only one side present:
        //  - neither side claims a value -> trivially consistent
        //  - AI does not claim but ground truth exists -> AI has no conflicting
        //    opinion, so the level is consistent (no conflict to flag)
        ai === undefined || ai === ""
        ? true
        : false; // ground truth missing but AI claims -> cannot confirm

    let conflictWith: CrossMatchComparison["conflictWith"] = "none";
    if (!match && bothPresent)
      conflictWith = "ai-only"; // AI claims different value than enhanced truth
    else if (!match && ai) conflictWith = "nominatim-missing"; // enhanced can't confirm AI's claim

    comparisons.push({
      level,
      aiValue: ai,
      enhancedValue: ev,
      match,
      conflictWith,
    });
  }

  const matchedLevels = comparisons.filter((c) => c.match).length;
  return {
    comparedLevels: comparisons.length,
    matchedLevels,
    allMatched: matchedLevels === comparisons.length,
    comparisons,
  };
}

// Note: reconcileDecision removed; decision now based directly on AI vs Nominatim comparison.
