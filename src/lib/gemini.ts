import {
  AIValidationAnalysis,
  Coordinate,
  ErrorType,
  ExpectedAddress,
  NominatimAddress,
  ValidationStatus,
} from "@/types";

interface GeminiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function getGeminiConfig(): GeminiConfig | null {
  const apiKey = process.env.GEMINI_API_KEY;
  const baseUrl = process.env.GEMINI_BASE_URL;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  if (!apiKey) return null;
  return { apiKey, baseUrl: baseUrl || "https://generativelanguage.googleapis.com", model };
}

function buildPrompt(coord: Coordinate, nominatim: NominatimAddress, expected?: ExpectedAddress): string {
  const expectedBlock = expected
    ? `EXPECTED/CORRECT ADDRESS:
- Road: ${expected.road || "N/A"}
- Kelurahan/Desa: ${expected.village || "N/A"}
- Kecamatan: ${expected.district || "N/A"}
- Kabupaten/Kota: ${expected.city || "N/A"}
- Provinsi: ${expected.province || "N/A"}
- Postal Code: ${expected.postcode || "N/A"}`
    : "EXPECTED/CORRECT ADDRESS: Not provided - validate based on Indonesia administrative hierarchy knowledge and coordinate plausibility.";

  return `You are an Indonesian address validation AI. Validate the reverse-geocoding result against known Indonesian administrative boundaries.

COORDINATE: ${coord.lat}, ${coord.lon}

NOMINATIM RESULT:
- Road: ${nominatim.road || "N/A"}
- Kelurahan/Desa: ${nominatim.village || "N/A"}
- Kecamatan: ${nominatim.district || "N/A"}
- Kabupaten/Kota: ${nominatim.city || "N/A"}
- Provinsi: ${nominatim.state || "N/A"}
- Postal Code: ${nominatim.postcode || "N/A"}

${expectedBlock}

Consider:
1. Consistency of administrative hierarchy (village must belong to district, district to city, city to province)
2. Plausibility of the address at the given coordinates (Indonesian territory, province boundaries)
3. Missing required fields (kelurahan/kecamatan/kota commonly missing in Nominatim)
4. Compare every field against expected values when provided

Respond with STRICT JSON only, no markdown, no explanation:
{
  "isValid": boolean,
  "status": "VALID" | "NEED_REVIEW" | "INCORRECT",
  "confidenceScore": number (0-100),
  "errorTypes": ["WRONG_ROAD" | "WRONG_VILLAGE" | "WRONG_DISTRICT" | "WRONG_CITY" | "WRONG_PROVINCE" | "MISSING_DATA" | "WRONG_HIERARCHY" | "LOW_CONFIDENCE"],
  "hierarchyConsistent": boolean,
  "notes": "short explanation",
  "expectedAddress": {
    "road": string,
    "village": string,
    "district": string,
    "city": string,
    "province": string,
    "postcode": string
  }
}`;
}

function parseGeminiResponse(text: string): AIValidationAnalysis | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(cleaned.substring(start, end + 1));
  } catch {
    return null;
  }
}

export async function validateWithGemini(
  coord: Coordinate,
  nominatim: NominatimAddress,
  expected?: ExpectedAddress
): Promise<AIValidationAnalysis> {
  const config = getGeminiConfig();
  if (!config) {
    // Fallback heuristic validation when no Gemini API key configured
    return heuristicValidation(coord, nominatim, expected);
  }

  const prompt = buildPrompt(coord, nominatim, expected);
  const url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            isValid: { type: "BOOLEAN" },
            status: { type: "STRING" },
            confidenceScore: { type: "NUMBER" },
            errorTypes: { type: "ARRAY", items: { type: "STRING" } },
            hierarchyConsistent: { type: "BOOLEAN" },
            notes: { type: "STRING" },
            expectedAddress: {
              type: "OBJECT",
              properties: {
                road: { type: "STRING" },
                village: { type: "STRING" },
                district: { type: "STRING" },
                city: { type: "STRING" },
                province: { type: "STRING" },
                postcode: { type: "STRING" },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = parseGeminiResponse(text);

  if (parsed) {
    return {
      ...parsed,
      status: parsed.status || (parsed.isValid ? "VALID" : "NEED_REVIEW"),
    };
  }

  return heuristicValidation(coord, nominatim, expected);
}

function heuristicValidation(
  coord: Coordinate,
  nominatim: NominatimAddress,
  expected?: ExpectedAddress
): AIValidationAnalysis {
  const errors: ErrorType[] = [];
  const inIndonesia =
    coord.lat >= -12 && coord.lat <= 6 && coord.lon >= 95 && coord.lon <= 141;

  if (!inIndonesia) errors.push("WRONG_HIERARCHY");
  if (!nominatim.road) errors.push("MISSING_DATA");
  if (!nominatim.village) errors.push("MISSING_DATA");
  if (!nominatim.district) errors.push("MISSING_DATA");
  if (!nominatim.city) errors.push("MISSING_DATA");
  if (!nominatim.state) errors.push("MISSING_DATA");

  if (expected) {
    const fieldChecks: [keyof ExpectedAddress, ErrorType][] = [
      ["road", "WRONG_ROAD"],
      ["village", "WRONG_VILLAGE"],
      ["district", "WRONG_DISTRICT"],
      ["city", "WRONG_CITY"],
      ["province", "WRONG_PROVINCE"],
    ];
    for (const [field, errorType] of fieldChecks) {
      const expectedVal = normalize(expected[field]);
      const actualVal =
        field === "province"
          ? normalize(nominatim.state)
          : field === "village"
          ? normalize(nominatim.village)
          : field === "district"
          ? normalize(nominatim.district)
          : field === "city"
          ? normalize(nominatim.city)
          : normalize(nominatim.road);
      if (expectedVal && actualVal && expectedVal !== actualVal) {
        errors.push(errorType);
      }
    }
  }

  const hasErrors = errors.length > 0;
  const confidenceScore = Math.max(20, 100 - errors.length * 15);
  const status: ValidationStatus = hasErrors ? "NEED_REVIEW" : "VALID";

  return {
    isValid: !hasErrors,
    status,
    confidenceScore,
    errorTypes: [...new Set(errors)],
    hierarchyConsistent: !errors.includes("WRONG_HIERARCHY"),
    notes: hasErrors
      ? `Heuristic validation found ${errors.length} issue(s): ${[...new Set(errors)].join(", ")}`
      : "Heuristic validation passed all checks.",
    expectedAddress: expected || {},
  };
}

function normalize(val?: string): string {
  if (!val) return "";
  return val.toLowerCase().replace(/\s+/g, " ").trim();
}