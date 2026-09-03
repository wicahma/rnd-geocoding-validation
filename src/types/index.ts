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
  | "LOW_CONFIDENCE";

export type ValidationStatus = "VALID" | "NEED_REVIEW" | "INCORRECT";

export interface AIValidationAnalysis {
  isValid: boolean;
  status: ValidationStatus;
  confidenceScore: number;
  errorTypes: ErrorType[];
  hierarchyConsistent: boolean;
  notes: string;
  expectedAddress: ExpectedAddress;
}

export interface ValidationRecord {
  id: string;
  coordinate: Coordinate;
  nominatimResult: NominatimAddress;
  expectedAddress?: ExpectedAddress;
  aiValidation: AIValidationAnalysis;
  testedAt: string;
  provinceTarget?: string;
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
  errorDistribution: { errorType: ErrorType; count: number; percentage: number }[];
}
