import {
  ErrorType,
  ProvinceAIRecap,
  ProvinceQualityAggregates,
  ValidationRecord,
} from "@/types";
import { getAllRecords } from "@/lib/storage";

// In-memory / file cached recaps
const RECAP_CACHE = new Map<string, ProvinceAIRecap>();

/**
 * Computes deterministic aggregates per province from all stored validation records
 */
export async function getProvinceAggregates(
  provinceName?: string
): Promise<ProvinceQualityAggregates[]> {
  const records = await getAllRecords();

  const grouped = new Map<string, ValidationRecord[]>();

  for (const r of records) {
    const prov =
      r.provinceTarget ||
      r.nominatimResult.state ||
      r.expectedAddress?.province ||
      "Unknown";
    const list = grouped.get(prov) || [];
    list.push(r);
    grouped.set(prov, list);
  }

  const results: ProvinceQualityAggregates[] = [];

  for (const [prov, provRecords] of grouped.entries()) {
    if (provinceName && prov.toLowerCase() !== provinceName.toLowerCase()) {
      continue;
    }

    const totalTested = provRecords.length;
    const validCount = provRecords.filter(
      (r) => r.aiValidation.status === "VALID"
    ).length;
    const invalidCount = provRecords.filter(
      (r) => r.aiValidation.status === "INCORRECT"
    ).length;
    const needReviewCount = provRecords.filter(
      (r) => r.aiValidation.status === "NEED_REVIEW"
    ).length;

    const validityRate =
      totalTested > 0 ? Math.round((validCount / totalTested) * 1000) / 10 : 0;
    const errorRate =
      totalTested > 0
        ? Math.round(((invalidCount + needReviewCount) / totalTested) * 1000) / 10
        : 0;

    const totalConf = provRecords.reduce(
      (acc, r) => acc + (r.aiValidation.confidenceScore || 0),
      0
    );
    const averageConfidence =
      totalTested > 0 ? Math.round((totalConf / totalTested) * 10) / 10 : 0;

    // Error tallies
    const errorCounts = new Map<ErrorType, number>();
    const cityCounts = new Map<string, number>();
    let gisMismatches = 0;
    let roadMismatches = 0;
    let missingData = 0;
    let lowConf = 0;

    let roadCorrect = 0;
    let villageCorrect = 0;
    let districtCorrect = 0;
    let cityCorrect = 0;
    let provinceCorrect = 0;

    for (const r of provRecords) {
      const errs = r.aiValidation.errorTypes || [];
      for (const err of errs) {
        errorCounts.set(err, (errorCounts.get(err) || 0) + 1);
        if (err.includes("GIS")) gisMismatches++;
        if (err.includes("ROAD")) roadMismatches++;
        if (err === "MISSING_DATA") missingData++;
        if (err === "LOW_CONFIDENCE") lowConf++;
      }

      if (!errs.includes("WRONG_ROAD")) roadCorrect++;
      if (!errs.includes("WRONG_VILLAGE")) villageCorrect++;
      if (!errs.includes("WRONG_DISTRICT")) districtCorrect++;
      if (!errs.includes("WRONG_CITY")) cityCorrect++;
      if (!errs.includes("WRONG_PROVINCE")) provinceCorrect++;

      const city =
        r.nominatimResult.city || r.expectedAddress?.city || "Unknown City";
      if (errs.length > 0) {
        cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
      }
    }

    const topErrors = Array.from(errorCounts.entries())
      .map(([errorType, count]) => ({ errorType, count }))
      .sort((a, b) => b.count - a.count);

    const affectedCities = Array.from(cityCounts.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    results.push({
      province: prov,
      totalTested,
      validCount,
      invalidCount,
      needReviewCount,
      validityRate,
      errorRate,
      averageConfidence,
      levelAccuracy: {
        road: totalTested > 0 ? Math.round((roadCorrect / totalTested) * 100) : 0,
        village:
          totalTested > 0 ? Math.round((villageCorrect / totalTested) * 100) : 0,
        district:
          totalTested > 0 ? Math.round((districtCorrect / totalTested) * 100) : 0,
        city: totalTested > 0 ? Math.round((cityCorrect / totalTested) * 100) : 0,
        province:
          totalTested > 0 ? Math.round((provinceCorrect / totalTested) * 100) : 0,
      },
      topErrors,
      gisMismatchCount: gisMismatches,
      roadMismatchCount: roadMismatches,
      missingDataCount: missingData,
      lowConfidenceCount: lowConf,
      affectedCities,
      lastUpdated: new Date().toISOString(),
    });
  }

  return results.sort((a, b) => b.errorRate - a.errorRate);
}

/**
 * Generate AI Quality Recap for a given province based strictly on aggregated statistics
 */
export async function generateProvinceAIRecap(
  provinceName: string
): Promise<ProvinceAIRecap> {
  const aggs = await getProvinceAggregates(provinceName);
  const agg = aggs.find(
    (a) => a.province.toLowerCase() === provinceName.toLowerCase()
  );

  const datasetVersion = "2026.1";
  const aggregationVersion = `${agg?.totalTested || 0}-${agg?.lastUpdated || "0"}`;
  const cacheKey = `${provinceName}:${datasetVersion}:${aggregationVersion}`;

  if (RECAP_CACHE.has(cacheKey)) {
    return RECAP_CACHE.get(cacheKey)!;
  }

  if (!agg || agg.totalTested === 0) {
    const emptyRecap: ProvinceAIRecap = {
      province: provinceName,
      datasetVersion,
      aggregationVersion,
      summary: `Belum ada data sampel validasi untuk ${provinceName}.`,
      qualityAssessment: "INSUFFICIENT_DATA",
      majorProblems: [],
      worstAreas: [],
      dominantErrorTypes: [],
      possibleCauses: [],
      recommendedImprovements: ["Jalankan grid sampling untuk mengumpulkan data evaluasi."],
      priority: "LOW",
      generatedAt: new Date().toISOString(),
      source: "heuristic",
    };
    return emptyRecap;
  }

  // Generate deterministic heuristic recap without relying on AI hallucination
  const priority =
    agg.errorRate > 25
      ? "CRITICAL"
      : agg.errorRate > 15
      ? "HIGH"
      : agg.errorRate > 5
      ? "MEDIUM"
      : "LOW";

  const majorProblems: string[] = [];
  if (agg.levelAccuracy.village < 80) {
    majorProblems.push(
      `Akurasi tingkat kelurahan/desa rendah (${agg.levelAccuracy.village}%).`
    );
  }
  if (agg.levelAccuracy.road < 70) {
    majorProblems.push(
      `Akurasi nama jalan Nominatim rendah (${agg.levelAccuracy.road}%).`
    );
  }
  if (agg.gisMismatchCount > 0) {
    majorProblems.push(
      `Terdapat ${agg.gisMismatchCount} titik koordinat yang melanggar batas administratif GIS.`
    );
  }

  const recap: ProvinceAIRecap = {
    province: provinceName,
    datasetVersion,
    aggregationVersion,
    summary: `Provinsi ${provinceName} memiliki total ${agg.totalTested} pengujian dengan error rate ${agg.errorRate}% dan confidence rata-rata ${agg.averageConfidence}%.`,
    qualityAssessment:
      agg.errorRate <= 10
        ? "GOOD: Kualitas geocoding memenuhi batas toleransi operasional."
        : "NEEDS_IMPROVEMENT: Terdeteksi ketidaksesuaian sistematis pada hierarki administratif.",
    majorProblems:
      majorProblems.length > 0 ? majorProblems : ["Tidak ditemukan anomali dominan."],
    worstAreas: agg.affectedCities.map((c) => `${c.city} (${c.count} error)`),
    dominantErrorTypes: agg.topErrors.slice(0, 3).map((e) => `${e.errorType} (${e.count})`),
    possibleCauses: [
      "Perbedaan batas wilayah BPS dengan poligon OSM Nominatim.",
      "Kekosongan tag jalan sekunder/tersier pada data reverse-geocoding publik.",
    ],
    recommendedImprovements: [
      "Gunakan GIS Point-in-Polygon sebagai filter deterministik primer.",
      "Tambahkan alias penamaan daerah lokal pada dataset koreksi.",
    ],
    priority,
    generatedAt: new Date().toISOString(),
    source: "heuristic",
  };

  RECAP_CACHE.set(cacheKey, recap);
  return recap;
}
