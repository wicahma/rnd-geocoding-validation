import { promises as fs } from "fs";
import path from "path";
import { ErrorType, QualityMetrics, ValidationRecord } from "@/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "records.json");

async function ensureDataFile(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(DATA_FILE);
    } catch {
      console.log("[storage] Creating empty records file");
      await fs.writeFile(DATA_FILE, JSON.stringify([]));
    }
  } catch (err) {
    console.error("[storage] Failed to init data file:", err);
  }
}

export async function getAllRecords(): Promise<ValidationRecord[]> {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const records = JSON.parse(raw);
    console.log(`[storage] getAllRecords: loaded ${records.length} record(s)`);
    return records;
  } catch {
    return [];
  }
}

export async function saveRecord(record: ValidationRecord): Promise<void> {
  await ensureDataFile();
  const records = await getAllRecords();
  records.unshift(record);
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2));
  console.log(
    `[storage] saveRecord: saved record ${record.id} (status=${record.aiValidation.status})`,
  );
}

export async function saveBatchRecords(
  newRecords: ValidationRecord[],
): Promise<void> {
  await ensureDataFile();
  const records = await getAllRecords();
  const merged = [...newRecords, ...records];
  await fs.writeFile(DATA_FILE, JSON.stringify(merged, null, 2));
  console.log(
    `[storage] saveBatchRecords: added ${newRecords.length} record(s), total now ${merged.length}`,
  );
}

export async function getCorrectionLogs(): Promise<ValidationRecord[]> {
  const records = await getAllRecords();
  const logs = records.filter(
    (r) =>
      r.aiValidation.status === "INCORRECT" ||
      r.aiValidation.status === "NEED_REVIEW",
  );
  console.log(`[storage] getCorrectionLogs: returning ${logs.length} log(s)`);
  return logs;
}

export async function getVerifiedAssets(): Promise<ValidationRecord[]> {
  const records = await getAllRecords();
  const verified = records.filter((r) => r.aiValidation.status === "VALID");
  console.log(
    `[storage] getVerifiedAssets: returning ${verified.length} verified asset(s)`,
  );
  return verified;
}

export async function getQualityMetrics(): Promise<QualityMetrics> {
  const records = await getAllRecords();
  const total = records.length;
  console.log(`[storage] getQualityMetrics: computing over ${total} record(s)`);

  if (total === 0) {
    console.log(
      "[storage] getQualityMetrics: no records, returning empty metrics",
    );
    return {
      totalTested: 0,
      valid: 0,
      needReview: 0,
      incorrect: 0,
      overallConfidence: 0,
      accuracyPerLevel: {
        road: 0,
        village: 0,
        district: 0,
        city: 0,
        province: 0,
      },
      topErrors: [],
      errorDistribution: [],
    };
  }

  const valid = records.filter((r) => r.aiValidation.status === "VALID").length;
  const needReview = records.filter(
    (r) => r.aiValidation.status === "NEED_REVIEW",
  ).length;
  const incorrect = records.filter(
    (r) => r.aiValidation.status === "INCORRECT",
  ).length;

  const totalConfidence = records.reduce(
    (acc, r) => acc + (r.aiValidation.confidenceScore || 0),
    0,
  );
  const overallConfidence = Math.round((totalConfidence / total) * 10) / 10;

  const errorCounts: Record<string, number> = {};
  let roadErrors = 0,
    villageErrors = 0,
    districtErrors = 0,
    cityErrors = 0,
    provinceErrors = 0;

  for (const r of records) {
    for (const err of r.aiValidation.errorTypes || []) {
      errorCounts[err] = (errorCounts[err] || 0) + 1;
      if (err === "WRONG_ROAD") roadErrors++;
      if (err === "WRONG_VILLAGE") villageErrors++;
      if (err === "WRONG_DISTRICT") districtErrors++;
      if (err === "WRONG_CITY") cityErrors++;
      if (err === "WRONG_PROVINCE") provinceErrors++;
    }
  }

  const calcAcc = (errors: number) =>
    Math.max(0, Math.round(((total - errors) / total) * 1000) / 10);

  const errorDistribution = Object.entries(errorCounts)
    .map(([type, count]) => ({
      errorType: type as ErrorType,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  const topErrors = errorDistribution.slice(0, 5).map((e) => ({
    errorType: e.errorType,
    count: e.count,
  }));

  console.log(
    `[storage] getQualityMetrics: total=${total}, valid=${valid}, needReview=${needReview}, incorrect=${incorrect}, overallConfidence=${overallConfidence}%`,
  );

  return {
    totalTested: total,
    valid,
    needReview,
    incorrect,
    overallConfidence,
    accuracyPerLevel: {
      road: calcAcc(roadErrors),
      village: calcAcc(villageErrors),
      district: calcAcc(districtErrors),
      city: calcAcc(cityErrors),
      province: calcAcc(provinceErrors),
    },
    topErrors,
    errorDistribution,
  };
}
