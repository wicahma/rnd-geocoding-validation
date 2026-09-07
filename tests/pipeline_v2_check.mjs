import assert from "assert";
import { normalizeRoadName, calculateStringSimilarity, validateRoadLevel } from "../src/lib/road/validator";
import { validateAgainstGIS, normalizeAdminName } from "../src/lib/gis/validator";

async function runTests() {
  console.log("--- Testing Road Validation ---");
  // 1. Normalization
  const norm1 = normalizeRoadName("Jl. Jendral Sudirman No. 12");
  assert.strictEqual(norm1.normalized, "jendralsudirman");

  // 2. Similarity
  const sim = calculateStringSimilarity("sudirman", "sudirman");
  assert.strictEqual(sim, 1.0);

  const diffSim = calculateStringSimilarity("sudirman", "gajahmada");
  assert.ok(diffSim < 0.3);

  // 3. Road Level Validation
  const roadMatch = validateRoadLevel(
    { lat: -6.2, lon: 106.8 },
    "Jl. Sudirman",
    "Jalan Sudirman"
  );
  assert.strictEqual(roadMatch.match, true);
  assert.strictEqual(roadMatch.errorType, undefined);

  const roadMismatch = validateRoadLevel(
    { lat: -6.2, lon: 106.8 },
    "Jl. Sudirman",
    "Jl. Gatot Subroto"
  );
  assert.strictEqual(roadMismatch.match, false);
  assert.strictEqual(roadMismatch.errorType, "ROAD_NAME_MISMATCH");

  console.log("--- Testing GIS Deterministic Validation ---");
  // 4. Admin Name Normalization
  assert.strictEqual(normalizeAdminName("Kota Yogyakarta"), "yogyakarta");
  assert.strictEqual(normalizeAdminName("Provinsi Jawa Barat"), "jawabarat");

  // 5. GIS Validation
  const gisRes = validateAgainstGIS(
    { lat: -6.2146, lon: 106.84851 }, // Jakarta coords
    { state: "DKI Jakarta", displayName: "Jakarta" }
  );
  assert.strictEqual(gisRes.available, true);
  assert.strictEqual(gisRes.allMatched, true);

  console.log("✓ All unit checks passed successfully!");
}

runTests().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
