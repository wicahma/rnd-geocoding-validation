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

  if (!apiKey) {
    console.log(
      "[gemini] No GEMINI_API_KEY configured - will use heuristic fallback",
    );
    return null;
  }
  console.log(
    `[gemini] Config loaded: baseUrl=${baseUrl || "https://generativelanguage.googleapis.com"}, model=${model}`,
  );
  return {
    apiKey,
    baseUrl: baseUrl || "https://generativelanguage.googleapis.com",
    model,
  };
}

function getMaxOutputTokens(): number {
  const raw = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 2048;
}

// Thinking models spend output tokens on reasoning before writing the answer,
// which can starve the JSON (the 22-token truncated responses we saw). Default:
// disable thinking (0). Set GEMINI_THINKING_BUDGET="" to omit the field, or a
// positive number (e.g. "1024") for a real reasoning budget.
function getThinkingBudget(): number | null {
  const raw = process.env.GEMINI_THINKING_BUDGET;
  if (raw === "") return null; // explicitly opt out of sending the field
  if (raw === undefined) return 0; // default: disable thinking
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export function buildPrompt(
  coord: Coordinate,
  nominatim: NominatimAddress,
  expected?: ExpectedAddress,
): string {
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

function extractModelText(data: unknown): string {
  const parts =
    (
      data as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string; thought?: boolean }> };
        }>;
      }
    )?.candidates?.[0]?.content?.parts ?? [];
  // Thinking models can interleave reasoning ("thought") parts; prefer the real answer.
  const answerParts = parts.filter(
    (p) => typeof p.text === "string" && !p.thought,
  );
  const chosen = answerParts.length > 0 ? answerParts : parts;
  return chosen
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

function parseGeminiResponse(text: string): AIValidationAnalysis | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  // 1) Strict parse of the region between the first '{' and last '}'.
  const end = cleaned.lastIndexOf("}");
  if (end > start) {
    try {
      return JSON.parse(cleaned.substring(start, end + 1));
    } catch {
      // fall through to salvage below
    }
  }

  // 2) Best-effort salvage of truncated/invalid JSON (e.g. output cut short by
  //    a maxOutputTokens cap), so we can still surface model data instead of
  //    silently dropping to the heuristic fallback.
  return salvageTruncatedJson(cleaned.substring(start));
}

function salvageTruncatedJson(raw: string): AIValidationAnalysis | null {
  const scanChars = 400;
  const lo = Math.max(0, raw.length - scanChars);
  for (let i = raw.length; i > lo; i--) {
    const closed = closeOpenStructures(raw.slice(0, i));
    if (closed == null) continue;
    try {
      const parsed = JSON.parse(closed);
      if (parsed && typeof parsed === "object") {
        console.warn("[gemini] Salvaged truncated/invalid model JSON");
        return parsed as AIValidationAnalysis;
      }
    } catch {
      // try a shorter prefix
    }
  }
  return null;
}

// Appends closers for any unclosed { / [ in a prefix. Returns null when the
// prefix ends inside an unterminated string (that value is incomplete).
function closeOpenStructures(s: string): string | null {
  let inString = false;
  let escaped = false;
  const stack: Array<"{" | "["> = [];
  for (const ch of s) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{" || ch === "[") {
      stack.push(ch as "{" | "[");
    } else if (ch === "}" || ch === "]") {
      const expected = ch === "}" ? "{" : "[";
      if (stack[stack.length - 1] === expected) stack.pop();
      else if (stack.length === 0) return null;
    }
  }
  if (inString) return null;
  const closers = stack
    .reverse()
    .map((c) => (c === "{" ? "}" : "]"))
    .join("");
  return s + closers;
}

export async function validateWithGemini(
  coord: Coordinate,
  nominatim: NominatimAddress,
  expected?: ExpectedAddress,
): Promise<AIValidationAnalysis> {
  console.log(
    `[gemini] validateWithGemini called: coord=${coord.lat},${coord.lon}, expected=${expected ? "yes" : "no"}`,
  );
  const config = getGeminiConfig();
  if (!config) {
    // Fallback heuristic validation when no Gemini API key configured
    console.log("[gemini] Falling back to heuristicValidation (no config)");
    return heuristicValidation(coord, nominatim, expected);
  }

  const prompt = buildPrompt(coord, nominatim, expected);
  const url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent`;
  console.log(
    `[gemini] Sending generateContent request to model=${config.model}`,
  );

  // Keep the payload minimal & schema-free for maximum compatibility with
  // OpenAI/Vertex-style proxies (LiteLLM): responseSchema + responseMimeType
  // can be mishandled upstream and cut responses short. We parse and validate
  // the model's JSON ourselves.
  const generationConfig: Record<string, unknown> = {
    temperature: 0.2,
    maxOutputTokens: getMaxOutputTokens(),
  };
  const thinking = getThinkingBudget();
  if (thinking !== null) {
    generationConfig.thinkingConfig = { thinkingBudget: thinking };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    console.log("Gemini API error response:", await response.text());
    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const usage =
    (
      data as {
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      }
    )?.usageMetadata ?? {};
  console.log(`[gemini] MODEL RAW RES BODY: ${JSON.stringify(data, null, 2)}`);
  console.log(
    `[gemini] Model RAW response: finishReason=${(data as { candidates?: Array<{ finishReason?: string }> })?.candidates?.[0]?.finishReason ?? "?"}, tokens(in/out)=${usage.promptTokenCount ?? "?"}/${usage.candidatesTokenCount ?? "?"}`,
  );
  const text = extractModelText(data);
  console.log(`[gemini] Extracted model text (${text.length} chars)`);
  const parsed = parseGeminiResponse(text);

  if (parsed) {
    console.log(
      `[gemini] Parsed AI validation: status=${parsed.status || (parsed.isValid ? "VALID" : "NEED_REVIEW")}, confidence=${parsed.confidenceScore}, errors=${(parsed.errorTypes || []).join(",") || "none"}`,
    );
    return {
      ...parsed,
      status: parsed.status || (parsed.isValid ? "VALID" : "NEED_REVIEW"),
    };
  }

  console.warn(
    `[gemini] Could NOT parse model JSON - falling back to heuristicValidation. Model text:\n${text.slice(0, 2000)}`,
  );
  return heuristicValidation(coord, nominatim, expected);
}

function heuristicValidation(
  coord: Coordinate,
  nominatim: NominatimAddress,
  expected?: ExpectedAddress,
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

  console.log(
    `[gemini] heuristicValidation result: status=${status}, confidence=${confidenceScore}, errors=${[...new Set(errors)].join(",") || "none"}`,
  );

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

/**
 * Manual single-shot Gemini call (no Nominatim step, no save). Reuses
 * validateWithGemini + buildPrompt so the payload/format stays identical to
 * the pipeline path, but the caller supplies the Nominatim result text.
 */
export async function sendToGemini(params: {
  coord: Coordinate;
  sourceText?: string;
  expected?: ExpectedAddress;
}): Promise<AIValidationAnalysis> {
  const { coord, sourceText, expected } = params;
  const config = getGeminiConfig();

  if (!config) {
    const nominatim = { displayName: sourceText || "" };
    return heuristicValidation(coord, nominatim, expected);
  }

  const url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent`;
  console.log(
    `[gemini] sendToGemini: model=${config.model}, sourceText=${sourceText ? sourceText.length : 0} chars`,
  );

  const generationConfig: Record<string, unknown> = {
    temperature: 0.2,
    maxOutputTokens: getMaxOutputTokens(),
  };
  const thinking = getThinkingBudget();
  if (thinking !== null) {
    generationConfig.thinkingConfig = { thinkingBudget: thinking };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: sourceText }] }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    console.log("Gemini API error response:", await response.text());
    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const usage =
    (
      data as {
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      }
    )?.usageMetadata ?? {};
  console.log(
    `[gemini] sendToGemini raw: finishReason=${(data as { candidates?: Array<{ finishReason?: string }> })?.candidates?.[0]?.finishReason ?? "?"}, tokens(in/out)=${usage.promptTokenCount ?? "?"}/${usage.candidatesTokenCount ?? "?"}`,
  );
  const text = extractModelText(data);
  console.log(`[gemini] sendToGemini extracted text (${text.length} chars)`);
  const parsed = parseGeminiResponse(text);

  if (parsed) {
    return {
      ...parsed,
      status: parsed.status || (parsed.isValid ? "VALID" : "NEED_REVIEW"),
    };
  }

  console.warn(
    `[gemini] sendToGemini could NOT parse model JSON. Model text:\n${text.slice(0, 2000)}`,
  );
  return {
    isValid: false,
    status: "NEED_REVIEW",
    confidenceScore: 0,
    errorTypes: ["MISSING_DATA"],
    hierarchyConsistent: false,
    notes: "Model response could not be parsed",
    expectedAddress: expected || {},
  };
}
