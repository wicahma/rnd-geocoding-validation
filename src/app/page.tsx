"use client";

import { useEffect, useState } from "react";
import {
  Coordinate,
  ExpectedAddress,
  QualityMetrics,
  ValidationRecord,
} from "@/types";
import { INDONESIA_PROVINCES } from "@/lib/sampler";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"test" | "logs" | "metrics">(
    "test",
  );
  const [lat, setLat] = useState("-6.2146");
  const [lon, setLon] = useState("106.8485");
  const [expected, setExpected] = useState<ExpectedAddress>({
    road: "",
    village: "",
    district: "",
    city: "",
    province: "",
    postcode: "",
  });

  const [loading, setLoading] = useState(false);
  const [latestRecord, setLatestRecord] = useState<ValidationRecord | null>(
    null,
  );
  const [records, setRecords] = useState<ValidationRecord[]>([]);
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [selectedProvince, setSelectedProvince] = useState(
    INDONESIA_PROVINCES[10].name,
  ); // DKI Jakarta
  const [gridSize, setGridSize] = useState(2);
  const [batchCount, setBatchCount] = useState(5);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    console.log("[page] Home mounted - fetching initial metrics & records");
    fetchMetrics();
    fetchRecords();
  }, []);

  const fetchMetrics = async () => {
    console.log("[page] fetchMetrics called");
    try {
      const res = await fetch("/api/analytics");
      if (res.ok) {
        const m = await res.json();
        console.log(`[page] fetchMetrics: total=${m?.totalTested}`);
        setMetrics(m);
      }
    } catch (e) {
      console.error("[page] fetchMetrics error:", e);
    }
  };

  const fetchRecords = async (type?: string) => {
    console.log(`[page] fetchRecords called (type=${type || "all"})`);
    try {
      const res = await fetch(`/api/corrections${type ? `?type=${type}` : ""}`);
      if (res.ok) {
        const recs = await res.json();
        console.log(`[page] fetchRecords: got ${recs?.length ?? 0} record(s)`);
        setRecords(recs);
      }
    } catch (e) {
      console.error("[page] fetchRecords error:", e);
    }
  };

  const handleSingleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    console.log(`[page] handleSingleTest: coord=${lat},${lon}`);
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinate: { lat: parseFloat(lat), lon: parseFloat(lon) },
          expected: hasExpectedData(expected) ? expected : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Validation failed");
      }
      const data = await res.json();
      console.log(
        `[page] handleSingleTest success: status=${data?.aiValidation?.status}, confidence=${data?.aiValidation?.confidenceScore}`,
      );
      setLatestRecord(data);
      fetchMetrics();
      fetchRecords();
    } catch (err: unknown) {
      console.error("[page] handleSingleTest error:", err);
      if (err instanceof Error) setErrorMsg(err.message);
      else setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGridSample = async () => {
    setLoading(true);
    setErrorMsg("");
    console.log(
      `[page] handleGridSample: province=${selectedProvince}, gridSize=${gridSize}`,
    );
    try {
      const prov = INDONESIA_PROVINCES.find((p) => p.name === selectedProvince);
      if (!prov) {
        console.warn(
          `[page] handleGridSample: province ${selectedProvince} not found`,
        );
        return;
      }
      const [latMin, lonMin, latMax, lonMax] = prov.bounds;
      const coords: Coordinate[] = [];
      const latStep = (latMax - latMin) / gridSize;
      const lonStep = (lonMax - lonMin) / gridSize;

      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          coords.push({
            lat: Math.round((latMin + latStep * (i + 0.5)) * 1e6) / 1e6,
            lon: Math.round((lonMin + lonStep * (j + 0.5)) * 1e6) / 1e6,
          });
        }
      }

      const res = await fetch("/api/validate/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: coords }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Batch validation failed");
      }

      console.log(`[page] handleGridSample success: batch submitted`);
      fetchMetrics();
      fetchRecords();
      setActiveTab("logs");
    } catch (err: unknown) {
      console.error("[page] handleGridSample error:", err);
      if (err instanceof Error) setErrorMsg(err.message);
      else setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRandomSample = async () => {
    setLoading(true);
    setErrorMsg("");
    console.log(`[page] handleRandomSample: batchCount=${batchCount}`);
    try {
      const coords: Coordinate[] = [];
      for (let i = 0; i < batchCount; i++) {
        const prov =
          INDONESIA_PROVINCES[
            Math.floor(Math.random() * INDONESIA_PROVINCES.length)
          ];
        const [latMin, lonMin, latMax, lonMax] = prov.bounds;
        coords.push({
          lat:
            Math.round((latMin + Math.random() * (latMax - latMin)) * 1e6) /
            1e6,
          lon:
            Math.round((lonMin + Math.random() * (lonMax - lonMin)) * 1e6) /
            1e6,
        });
      }

      const res = await fetch("/api/validate/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: coords }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Random sampling failed");
      }

      console.log(`[page] handleRandomSample success: batch submitted`);
      fetchMetrics();
      fetchRecords();
      setActiveTab("logs");
    } catch (err: unknown) {
      console.error("[page] handleRandomSample error:", err);
      if (err instanceof Error) setErrorMsg(err.message);
      else setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const hasExpectedData = (exp: ExpectedAddress) =>
    Boolean(
      exp.road ||
      exp.village ||
      exp.district ||
      exp.city ||
      exp.province ||
      exp.postcode,
    );

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-12 font-mono">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="border-b border-neutral-800 pb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white uppercase">
                GeoMaps Nominatim Quality Enhancement Pipeline
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Berijalan Address Cleansing & Verified Location Data Asset
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("test")}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  activeTab === "test"
                    ? "bg-white text-black"
                    : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
                }`}
              >
                1. Test & Validate
              </button>
              <button
                onClick={() => {
                  setActiveTab("logs");
                  fetchRecords();
                }}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  activeTab === "logs"
                    ? "bg-white text-black"
                    : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
                }`}
              >
                2. Correction Log
              </button>
              <button
                onClick={() => {
                  setActiveTab("metrics");
                  fetchMetrics();
                }}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  activeTab === "metrics"
                    ? "bg-white text-black"
                    : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
                }`}
              >
                3. Quality Dashboard
              </button>
            </div>
          </div>
        </header>

        {errorMsg && (
          <div className="p-4 bg-red-950/50 border border-red-800 text-red-200 text-xs">
            {errorMsg}
          </div>
        )}

        {activeTab === "test" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                  Single Coordinate Test
                </h2>
                <form onSubmit={handleSingleTest} className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">
                        Latitude
                      </label>
                      <input
                        type="text"
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white focus:outline-none focus:border-neutral-500"
                        placeholder="-6.2146"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">
                        Longitude
                      </label>
                      <input
                        type="text"
                        value={lon}
                        onChange={(e) => setLon(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white focus:outline-none focus:border-neutral-500"
                        placeholder="106.8485"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-neutral-800">
                    <p className="text-xs text-neutral-400 font-semibold uppercase">
                      Expected Address (Optional Ground Truth)
                    </p>
                    <input
                      type="text"
                      placeholder="Road / Jl."
                      value={expected.road}
                      onChange={(e) =>
                        setExpected({ ...expected, road: e.target.value })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Kelurahan / Desa"
                        value={expected.village}
                        onChange={(e) =>
                          setExpected({ ...expected, village: e.target.value })
                        }
                        className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="Kecamatan"
                        value={expected.district}
                        onChange={(e) =>
                          setExpected({ ...expected, district: e.target.value })
                        }
                        className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Kabupaten / Kota"
                        value={expected.city}
                        onChange={(e) =>
                          setExpected({ ...expected, city: e.target.value })
                        }
                        className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="Provinsi"
                        value={expected.province}
                        onChange={(e) =>
                          setExpected({ ...expected, province: e.target.value })
                        }
                        className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-black font-semibold uppercase py-2.5 text-xs tracking-wider hover:bg-neutral-200 transition disabled:opacity-50"
                  >
                    {loading
                      ? "Processing Pipeline..."
                      : "Execute Validation Pipeline"}
                  </button>
                </form>
              </div>

              <div className="border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                  Batch Sampling (38 Provinces)
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">
                      Target Province
                    </label>
                    <select
                      value={selectedProvince}
                      onChange={(e) => setSelectedProvince(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                    >
                      {INDONESIA_PROVINCES.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">
                      Grid Density ({gridSize}x{gridSize} ={" "}
                      {gridSize * gridSize} points)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      value={gridSize}
                      onChange={(e) => setGridSize(parseInt(e.target.value))}
                      className="w-full accent-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGridSample}
                    disabled={loading}
                    className="w-full border border-neutral-700 hover:border-white text-white font-semibold uppercase py-2 text-xs tracking-wider transition disabled:opacity-50"
                  >
                    Run Province Grid Sampling
                  </button>

                  <div className="pt-2 border-t border-neutral-800 flex gap-2">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={batchCount}
                      onChange={(e) =>
                        setBatchCount(parseInt(e.target.value) || 1)
                      }
                      className="w-20 bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={handleRandomSample}
                      disabled={loading}
                      className="flex-1 border border-neutral-700 hover:border-white text-white font-semibold uppercase py-2 text-xs tracking-wider transition disabled:opacity-50"
                    >
                      Random Sample (Nationwide)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {latestRecord ? (
                <div className="border border-neutral-800 bg-neutral-900/40 p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
                    <div>
                      <span className="text-xs text-neutral-400 uppercase">
                        Test Execution Result
                      </span>
                      <p className="text-xs text-neutral-500">
                        {latestRecord.testedAt}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 text-xs font-bold uppercase ${
                          latestRecord.aiValidation.status === "VALID"
                            ? "bg-green-950 text-green-400 border border-green-800"
                            : latestRecord.aiValidation.status === "NEED_REVIEW"
                              ? "bg-yellow-950 text-yellow-400 border border-yellow-800"
                              : "bg-red-950 text-red-400 border border-red-800"
                        }`}
                      >
                        {latestRecord.aiValidation.status}
                      </span>
                      <span className="text-xs text-neutral-400 border border-neutral-800 px-2 py-1">
                        Confidence: {latestRecord.aiValidation.confidenceScore}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-neutral-800 p-4 space-y-2">
                      <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                        Nominatim Result
                      </h3>
                      <div className="text-xs space-y-1">
                        <p>
                          <span className="text-neutral-500">Road:</span>{" "}
                          {latestRecord.nominatimResult.road || "-"}
                        </p>
                        <p>
                          <span className="text-neutral-500">Kelurahan:</span>{" "}
                          {latestRecord.nominatimResult.village || "-"}
                        </p>
                        <p>
                          <span className="text-neutral-500">Kecamatan:</span>{" "}
                          {latestRecord.nominatimResult.district || "-"}
                        </p>
                        <p>
                          <span className="text-neutral-500">Kota:</span>{" "}
                          {latestRecord.nominatimResult.city || "-"}
                        </p>
                        <p>
                          <span className="text-neutral-500">Provinsi:</span>{" "}
                          {latestRecord.nominatimResult.state || "-"}
                        </p>
                        <p>
                          <span className="text-neutral-500">Postal Code:</span>{" "}
                          {latestRecord.nominatimResult.postcode || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="border border-neutral-800 p-4 space-y-2">
                      <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                        Expected / AI Corrected
                      </h3>
                      <div className="text-xs space-y-1">
                        <p>
                          <span className="text-neutral-500">Road:</span>{" "}
                          {latestRecord.aiValidation.expectedAddress?.road ||
                            latestRecord.expectedAddress?.road ||
                            "-"}
                        </p>
                        <p>
                          <span className="text-neutral-500">Kelurahan:</span>{" "}
                          {latestRecord.aiValidation.expectedAddress?.village ||
                            latestRecord.expectedAddress?.village ||
                            "-"}
                        </p>
                        <p>
                          <span className="text-neutral-500">Kecamatan:</span>{" "}
                          {latestRecord.aiValidation.expectedAddress
                            ?.district ||
                            latestRecord.expectedAddress?.district ||
                            "-"}
                        </p>
                        <p>
                          <span className="text-neutral-500">Kota:</span>{" "}
                          {latestRecord.aiValidation.expectedAddress?.city ||
                            latestRecord.expectedAddress?.city ||
                            "-"}
                        </p>
                        <p>
                          <span className="text-neutral-500">Provinsi:</span>{" "}
                          {latestRecord.aiValidation.expectedAddress
                            ?.province ||
                            latestRecord.expectedAddress?.province ||
                            "-"}
                        </p>
                        <p>
                          <span className="text-neutral-500">Postal Code:</span>{" "}
                          {latestRecord.aiValidation.expectedAddress
                            ?.postcode ||
                            latestRecord.expectedAddress?.postcode ||
                            "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                      AI Validation Analysis
                    </h3>
                    <p className="text-xs text-neutral-300 bg-neutral-950 p-3 border border-neutral-800">
                      {latestRecord.aiValidation.notes}
                    </p>
                    {latestRecord.aiValidation.errorTypes?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {latestRecord.aiValidation.errorTypes.map((err) => (
                          <span
                            key={err}
                            className="text-[10px] uppercase font-semibold px-2 py-0.5 bg-red-950/60 border border-red-800 text-red-300"
                          >
                            {err}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border border-neutral-800 p-12 text-center text-neutral-600 text-xs">
                  Run a validation test on the left to see comparative analysis.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                Correction Log & Location Quality Database
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchRecords()}
                  className="px-3 py-1 bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 hover:text-white"
                >
                  All Logs
                </button>
                <button
                  onClick={() => fetchRecords("verified")}
                  className="px-3 py-1 bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 hover:text-white"
                >
                  Verified Assets Only
                </button>
              </div>
            </div>

            <div className="border border-neutral-800 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400 uppercase">
                    <th className="p-3">Coord</th>
                    <th className="p-3">Nominatim Result</th>
                    <th className="p-3">Expected / Correct</th>
                    <th className="p-3">Error Type</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-900/30">
                      <td className="p-3 text-neutral-400">
                        {r.coordinate.lat}, {r.coordinate.lon}
                      </td>
                      <td className="p-3">
                        <div className="text-neutral-300">
                          {r.nominatimResult.road || "(no road)"}
                        </div>
                        <div className="text-neutral-500 text-[11px]">
                          {r.nominatimResult.village || "-"},{" "}
                          {r.nominatimResult.district || "-"},{" "}
                          {r.nominatimResult.city || "-"}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-neutral-300">
                          {r.aiValidation.expectedAddress?.road ||
                            r.expectedAddress?.road ||
                            "-"}
                        </div>
                        <div className="text-neutral-500 text-[11px]">
                          {r.aiValidation.expectedAddress?.village ||
                            r.expectedAddress?.village ||
                            "-"}
                          ,{" "}
                          {r.aiValidation.expectedAddress?.district ||
                            r.expectedAddress?.district ||
                            "-"}
                        </div>
                      </td>
                      <td className="p-3">
                        {r.aiValidation.errorTypes?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {r.aiValidation.errorTypes.map((e) => (
                              <span
                                key={e}
                                className="text-[9px] px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 text-neutral-300"
                              >
                                {e}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-neutral-600">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 ${
                            r.aiValidation.status === "VALID"
                              ? "text-green-400 bg-green-950/40 border border-green-800"
                              : "text-yellow-400 bg-yellow-950/40 border border-yellow-800"
                          }`}
                        >
                          {r.aiValidation.status}
                        </span>
                      </td>
                      <td className="p-3 text-neutral-400">
                        {r.aiValidation.confidenceScore}%
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-8 text-center text-neutral-600"
                      >
                        No validation records available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "metrics" && metrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border border-neutral-800 bg-neutral-900/40 p-4">
                <span className="text-[10px] uppercase text-neutral-500 font-bold">
                  Total Tested
                </span>
                <p className="text-2xl font-bold text-white mt-1">
                  {metrics.totalTested.toLocaleString()}
                </p>
              </div>
              <div className="border border-neutral-800 bg-neutral-900/40 p-4">
                <span className="text-[10px] uppercase text-green-500 font-bold">
                  Valid
                </span>
                <p className="text-2xl font-bold text-green-400 mt-1">
                  {metrics.valid.toLocaleString()}
                </p>
              </div>
              <div className="border border-neutral-800 bg-neutral-900/40 p-4">
                <span className="text-[10px] uppercase text-yellow-500 font-bold">
                  Need Review
                </span>
                <p className="text-2xl font-bold text-yellow-400 mt-1">
                  {metrics.needReview.toLocaleString()}
                </p>
              </div>
              <div className="border border-neutral-800 bg-neutral-900/40 p-4">
                <span className="text-[10px] uppercase text-neutral-400 font-bold">
                  Overall Confidence
                </span>
                <p className="text-2xl font-bold text-white mt-1">
                  {metrics.overallConfidence}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-neutral-800 bg-neutral-900/40 p-6 space-y-4">
                <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  Accuracy per Administrative Level
                </h3>
                <div className="space-y-3 text-xs">
                  {Object.entries(metrics.accuracyPerLevel).map(
                    ([level, acc]) => (
                      <div key={level} className="space-y-1">
                        <div className="flex justify-between text-neutral-400">
                          <span className="capitalize">{level}</span>
                          <span className="font-bold text-white">{acc}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full bg-white transition-all duration-300"
                            style={{ width: `${acc}%` }}
                          />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="border border-neutral-800 bg-neutral-900/40 p-6 space-y-4">
                <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  Top Error Distribution
                </h3>
                <div className="space-y-2 text-xs">
                  {metrics.errorDistribution.map((err) => (
                    <div
                      key={err.errorType}
                      className="flex justify-between items-center p-2 border border-neutral-800 bg-neutral-950"
                    >
                      <span className="text-neutral-300 font-semibold">
                        {err.errorType}
                      </span>
                      <div className="flex gap-3 text-neutral-500">
                        <span>{err.count} occurrences</span>
                        <span className="text-white font-bold">
                          {err.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {metrics.errorDistribution.length === 0 && (
                    <p className="text-neutral-600 text-center py-4">
                      No error trends recorded.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
