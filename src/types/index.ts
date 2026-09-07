export interface Coordinate {
  lat: number;
  lon: number;
}

export interface NominatimAddress {
  road?: string;
  village?: string;
  subdistrict?: string;
  district?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  displayName: string;
  confidence?: number;
}

export interface ExpectedAddress {
  road?: string;
  village?: string;
  district?: string;
  city?: string;
  province?: string;
  postcode?: string;
}

export type ErrorType =
  | "WRONG_ROAD"
  | "WRONG_VILLAGE"
  | "WRONG_DISTRICT"
  | "WRONG_CITY"
  | "WRONG_PROVINCE"
  | "MISSING_DATA"
  | "WRONG_HIERARCHY"
  | "LOW_CONFIDENCE"
  | "GIS_BOUNDARY_MISMATCH"
  | "ROAD_DISTANCE_EXCEEDED"
  | "ROAD_NAME_MISMATCH"
  | "GIS_DATA_UNAVAILABLE"
  | "AMBIGUOUS_BOUNDARY"
  | "MULTIPLE_BOUNDARY_MATCH";

export type ValidationStatus = "VALID" | "NEED_REVIEW" | "INCORRECT";

export interface AIValidationAnalysis {
  isValid: boolean;
  status: ValidationStatus;
  confidenceScore: number;
  errorTypes: ErrorType[];
  hierarchyConsistent: boolean;
  notes: string;
  expectedAddress: ExpectedAddress;
  /**
   * The enhanced pipeline result that AI was asked to cross-match against.
   * Filled by the engine (decision.ts), not returned by the model itself.
   */
  enhancedAddress?: ExpectedAddress & {
    source: string;
    datasetVersion?: string;
    boundaryIdentifiers?: AdminHierarchyCodes;
  };
  /**
   * Field-by-field AI-vs-enhanced cross-match (computed by the engine).
   */
  crossMatch?: CrossMatchResult;
}

export interface ValidationRecord {
  id: string;
  coordinate: Coordinate;
  nominatimResult: NominatimAddress;
  expectedAddress?: ExpectedAddress;
  aiValidation: AIValidationAnalysis;
  testedAt: string;
  provinceTarget?: string;
  // V2 Extended Evidence
  evidence?: ValidationEvidence;
}

export interface QualityMetrics {
  totalTested: number;
  valid: number;
  needReview: number;
  incorrect: number;
  overallConfidence: number;
  accuracyPerLevel: {
    road: number;
    village: number;
    district: number;
    city: number;
    province: number;
  };
  topErrors: { errorType: ErrorType; count: number }[];
  errorDistribution: {
    errorType: ErrorType;
    count: number;
    percentage: number;
  }[];
}

// ----------------------------------------------------
// V2 Enhanced Pipeline Types
// ----------------------------------------------------

export type AdminHierarchySource =
  | "shapefile_wilayah_boundaries_v2026.1"
  | "indonesia_bps_bounds_v1"
  | "manual_shapefile_overlay";

export interface AdminHierarchyCodes {
  provinceCode?: string;
  cityCode?: string;
  districtCode?: string;
  villageCode?: string;
}

export interface GISAdminHierarchy {
  province?: string;
  city?: string;
  district?: string;
  village?: string;
  source: AdminHierarchySource;
  datasetVersion: string;
  boundaryIdentifiers?: AdminHierarchyCodes;
}

export interface GISLevelComparison {
  level: "province" | "city" | "district" | "village";
  nominatimValue?: string;
  gisValue?: string;
  match: boolean;
  source: "gis";
  confidence: "deterministic";
}

export interface GISValidationResult {
  available: boolean;
  reason?: string;
  source?: AdminHierarchySource;
  datasetVersion?: string;
  hierarchy?: GISAdminHierarchy;
  comparisons: GISLevelComparison[];
  matchedLevelsCount: number;
  allMatched: boolean;
}

/**
 * The final decision = cross-match between the AI judgment and the
 * Nominatim address enhanced by deterministic GIS (polygon) + road layers.
 * Each admin level is compared field-by-field.
 */
export type CrossMatchLevel =
  | "province"
  | "city"
  | "district"
  | "village"
  | "road";

export interface CrossMatchComparison {
  level: CrossMatchLevel;
  /** Value claimed by AI / expected-address (the "AI side") */
  aiValue?: string;
  /** Ground truth value from enhanced pipeline (GIS shapefile / road / Nominatim) */
  enhancedValue?: string;
  /** Whether AI determination agrees with enhanced ground truth for this level */
  match: boolean;
  /**
   * Where the disagreement sits:
   * "enhanced-gis" | "enhanced-road" | "nominatim-missing" | "ai-only" |
   * "none" (agreed)
   */
  conflictWith:
    | "enhanced-gis"
    | "enhanced-road"
    | "nominatim-missing"
    | "ai-only"
    | "none";
}

export interface CrossMatchResult {
  /** Total admin levels compared (province, city, district, village, road) */
  comparedLevels: number;
  /** Number of levels where AI matches enhanced ground truth */
  matchedLevels: number;
  allMatched: boolean;
  comparisons: CrossMatchComparison[];
}

// ----------------------------------------------------
// V2 Enhanced Pipeline Types
// ----------------------------------------------------

export type ValidationDeterminedBy =
  | "cross_match_ai_vs_enhanced"
  | "deterministic_gis_road"
  | "ai_arbitration"
  | "fallback";

export type RoadType =
  | "highway"
  | "primary"
  | "secondary"
  | "tertiary"
  | "residential"
  | "service"
  | "generic";

export interface RoadValidationResult {
  available: boolean;
  reason?: string;
  nominatimRoad?: string;
  matchedRoad?: string;
  distanceMeter: number;
  thresholdMeter: number;
  nameSimilarity: number; // 0.0 - 1.0
  roadType: RoadType;
  roadId?: string;
  match: boolean;
  errorType?: "WRONG_ROAD" | "ROAD_DISTANCE_EXCEEDED" | "ROAD_NAME_MISMATCH";
}

export interface ValidationEvidence {
  validationId: string;
  coordinate: Coordinate;
  nominatim: {
    source: "nominatim" | "berijalan";
    data: NominatimAddress;
  };
  gisValidation: GISValidationResult;
  roadValidation: RoadValidationResult;
  aiValidation?: {
    source: "gemini" | "heuristic";
    invoked: boolean;
    analysis?: AIValidationAnalysis;
  };
  /** Enhanced address = Nominatim corrected with deterministic GIS + road */
  enhancedAddress?: ExpectedAddress & {
    source: string;
    datasetVersion?: string;
    boundaryIdentifiers?: AdminHierarchyCodes;
  };
  /** Cross-match of AI vs enhanced Nominatim */
  crossMatch?: CrossMatchResult;
  finalDecision: {
    status: ValidationStatus;
    determinedBy: ValidationDeterminedBy;
    confidenceScore: number;
    errorTypes: ErrorType[];
    reason: string;
  };
  timestamp: string;
}

export interface ProvinceQualityAggregates {
  province: string;
  totalTested: number;
  validCount: number;
  invalidCount: number;
  needReviewCount: number;
  validityRate: number; // 0 - 100
  errorRate: number; // 0 - 100
  averageConfidence: number;
  levelAccuracy: {
    road: number;
    village: number;
    district: number;
    city: number;
    province: number;
  };
  topErrors: { errorType: ErrorType; count: number }[];
  gisMismatchCount: number;
  roadMismatchCount: number;
  missingDataCount: number;
  lowConfidenceCount: number;
  affectedCities: { city: string; count: number }[];
  lastUpdated: string;
}

export interface ProvinceAIRecap {
  province: string;
  datasetVersion: string;
  aggregationVersion: string;
  summary: string;
  qualityAssessment: string;
  majorProblems: string[];
  worstAreas: string[];
  dominantErrorTypes: string[];
  possibleCauses: string[];
  recommendedImprovements: string[];
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  generatedAt: string;
  source: "gemini" | "cached" | "heuristic";
}
