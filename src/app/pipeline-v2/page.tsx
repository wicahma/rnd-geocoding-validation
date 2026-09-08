"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Coordinate,
  ExpectedAddress,
  ProvinceAIRecap,
  ProvinceQualityAggregates,
  ValidationRecord,
} from "@/types";
import { INDONESIA_PROVINCES } from "@/lib/sampler";
import {
  KABUPATEN_BY_PROVINSI,
  KECAMATAN_BY_KABUPATEN,
  PROVINSI,
} from "@/lib/kecamatan";
import { AdminLevel } from "@/lib/map/data";

const BoundaryMap = dynamic(() => import("@/components/map/BoundaryMap"), {
  ssr: false,
});

const PROV_KODE: Record<string, string> = Object.fromEntries(
  PROVINSI.map((p) => [p.nama, p.kode]),
);

export default function PipelineV2Page() {
  const [activeTab, setActiveTab] = useState<"test" | "logs" | "recap">("test");

  // Coordinate form inputs & Wilayah selection
  const [selectedProvince, setSelectedProvince] = useState(
    "Daerah Istimewa Yogyakarta",
  );
  const [autoAssign, setAutoAssign] = useState(true);
  const [kabupatenKode, setKabupatenKode] = useState("34.02"); // Bantul
  const [kecamatanName, setKecamatanName] = useState("Sewon");
  const [lat, setLat] = useState("-7.8495154");
  const [lon, setLon] = useState("110.3593989");
  const [expected, setExpected] = useState<ExpectedAddress>({
    road: "",
    village: "",
    district: "Sewon",
    city: "Bantul",
    province: "Daerah Istimewa Yogyakarta",
    postcode: "",
  });

  const provKode = PROV_KODE[selectedProvince] ?? "";
  const testKabupatenList = KABUPATEN_BY_PROVINSI[provKode] ?? [];
  const testKabupaten =
    testKabupatenList.find((k) => k.kode === kabupatenKode)?.nama ?? "";
  const testKabupatenPlain = testKabupaten.replace(/^(Kabupaten|Kota) /, "");
  const kecamatans = KECAMATAN_BY_KABUPATEN[kabupatenKode] ?? [];

  const handleProvinceChange = (provName: string) => {
    if (!autoAssign) return;
    setSelectedProvince(provName);
    const pKode = PROV_KODE[provName] ?? "";
    const kabs = KABUPATEN_BY_PROVINSI[pKode] ?? [];
    if (kabs.length > 0) {
      const firstKab = kabs[0];
      setKabupatenKode(firstKab.kode);
      const list = KECAMATAN_BY_KABUPATEN[firstKab.kode] ?? [];
      const plain = firstKab.nama.replace(/^(Kabupaten|Kota) /, "");
      if (list.length > 0) {
        const firstKec = list[0];
        setKecamatanName(firstKec.name);
        setLat(firstKec.lat.toFixed(6));
        setLon(firstKec.lon.toFixed(6));
        setExpected((prev) => ({
          ...prev,
          district: firstKec.name,
          city: plain,
          province: provName,
        }));
      } else {
        setKecamatanName("");
        setExpected((prev) => ({
          ...prev,
          district: "",
          city: plain,
          province: provName,
        }));
      }
    } else {
      setKabupatenKode("");
      setKecamatanName("");
      const p = INDONESIA_PROVINCES.find((x) => x.name === provName);
      if (p) {
        setLat(((p.bounds[0] + p.bounds[2]) / 2).toFixed(6));
        setLon(((p.bounds[1] + p.bounds[3]) / 2).toFixed(6));
      }
      setExpected((prev) => ({
        ...prev,
        district: "",
        city: "",
        province: provName,
      }));
    }
  };

  const handleKabupatenChange = (kabKode: string) => {
    if (!autoAssign) return;
    setKabupatenKode(kabKode);
    const kab = testKabupatenList.find((k) => k.kode === kabKode);
    const plain = kab?.nama ? kab.nama.replace(/^(Kabupaten|Kota) /, "") : "";
    const list = KECAMATAN_BY_KABUPATEN[kabKode] ?? [];
    if (list.length > 0) {
      const first = list[0];
      setKecamatanName(first.name);
      setLat(first.lat.toFixed(6));
      setLon(first.lon.toFixed(6));
      setExpected((prev) => ({
        ...prev,
        district: first.name,
        city: plain,
        province: selectedProvince,
      }));
    } else {
      setKecamatanName("");
      setExpected((prev) => ({
        ...prev,
        district: "",
        city: plain,
        province: selectedProvince,
      }));
    }
  };

  const handleKecamatanChange = (name: string) => {
    if (!autoAssign) return;
    // Update selected kecamatan & sync expected address
    setKecamatanName(name);
    const item = kecamatans.find((k) => k.name === name);
    if (item) {
      setLat(item.lat.toFixed(6));
      setLon(item.lon.toFixed(6));
      setExpected((prev) => ({
        ...prev,
        district: item.name,
        city: testKabupatenPlain,
        province: selectedProvince,
      }));
    }
  };

  // Clear province/kabupaten/kecamatan selections (keep manual lat/lon)
  const handleClearLocation = () => {
    setSelectedProvince("");
    setKabupatenKode("");
    setKecamatanName("");
    setExpected((prev) => ({
      ...prev,
      district: "",
      city: "",
      province: "",
    }));
  };

  // Toggles
  const [enableGIS, setEnableGIS] = useState(true);
  const [enableRoad, setEnableRoad] = useState(true);
  const [enableAIArbitration, setEnableAIArbitration] = useState(true);

  // States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [latestRecord, setLatestRecord] = useState<ValidationRecord | null>(
    null,
  );
  const [records, setRecords] = useState<ValidationRecord[]>([]);
  const [aggregates, setAggregates] = useState<ProvinceQualityAggregates[]>([]);
  const [selectedRecap, setSelectedRecap] = useState<ProvinceAIRecap | null>(
    null,
  );
  const [recapLoading, setRecapLoading] = useState(false);
  const [copiedCoord, setCopiedCoord] = useState(false);
  const [mapLevels, setMapLevels] = useState<AdminLevel[]>([
    "provinsi",
    "kabupaten",
    "kecamatan",
  ]);

  useEffect(() => {
    fetchRecords();
    fetchAggregates();
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await fetch("/api/corrections");
      if (res.ok) setRecords(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAggregates = async (province?: string) => {
    try {
      const url = `/api/v2/analytics/recap${province ? `?province=${encodeURIComponent(province)}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAggregates(data.aggregates || []);
        if (data.recap) setSelectedRecap(data.recap);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleProvinceSelectForRecap = async (provName: string) => {
    setRecapLoading(true);
    await fetchAggregates(provName);
    setRecapLoading(false);
  };

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/v2/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinate: { lat: parseFloat(lat), lon: parseFloat(lon) },
          expected: expected.province && autoAssign ? expected : undefined,
          options: {
            enableGIS,
            enableRoad,
            enableAIArbitration,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "V2 Validation failed");
      }

      const data: ValidationRecord = await res.json();

      console.log(
        `[validate] Response API data: ${JSON.stringify(data, null, 2)}`,
      );

      setLatestRecord(data);
      fetchRecords();
      fetchAggregates();
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
      else setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-10 font-mono">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Navbar */}
        <header className="border-b border-neutral-800 pb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-neutral-100 text-black uppercase">
                  V2 Pipeline
                </span>
                <h1 className="text-xl font-bold tracking-tight text-white uppercase">
                  GeoMaps Deterministic GIS & Road Quality Pipeline
                </h1>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Point-in-Polygon GIS Ground Truth → Road Verification → AI
                Semantic Arbitration
              </p>
            </div>

            {/* Navigation Switchers */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className="px-3 py-1.5 text-xs border border-neutral-800 hover:border-neutral-600 text-neutral-400"
              >
                Manual Test
              </Link>
              <Link
                href="/pipeline"
                className="px-3 py-1.5 text-xs border border-neutral-800 hover:border-neutral-600 text-neutral-400"
              >
                V1 Batch Pipeline
              </Link>
              <Link
                href="/peta-wilayah"
                className="px-3 py-1.5 text-xs border border-neutral-800 hover:border-neutral-600 text-neutral-400"
              >
                Map
              </Link>
              <button
                onClick={() => setActiveTab("test")}
                className={`px-3 py-1.5 text-xs font-semibold uppercase ${
                  activeTab === "test"
                    ? "bg-white text-black"
                    : "bg-neutral-900 border border-neutral-800 text-neutral-300"
                }`}
              >
                1. Test & Evidence
              </button>
              <button
                onClick={() => {
                  setActiveTab("logs");
                  fetchRecords();
                }}
                className={`px-3 py-1.5 text-xs font-semibold uppercase ${
                  activeTab === "logs"
                    ? "bg-white text-black"
                    : "bg-neutral-900 border border-neutral-800 text-neutral-300"
                }`}
              >
                2. Correction Logs
              </button>
              <button
                onClick={() => {
                  setActiveTab("recap");
                  fetchAggregates();
                }}
                className={`px-3 py-1.5 text-xs font-semibold uppercase ${
                  activeTab === "recap"
                    ? "bg-white text-black"
                    : "bg-neutral-900 border border-neutral-800 text-neutral-300"
                }`}
              >
                3. Province AI Recap
              </button>
            </div>
          </div>
        </header>

        {errorMsg && (
          <div className="p-3 bg-red-950/60 border border-red-800 text-red-200 text-xs">
            {errorMsg}
          </div>
        )}

        {/* TAB 1: TEST & VALIDATE */}
        {activeTab === "test" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-6">
              <div className="border border-neutral-800 bg-neutral-900/40 p-5 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Target Coordinate & Address
                </h2>
                {/* Auto assign toggle */}
                <label className="flex items-center gap-2 text-xs text-neutral-400">
                  <input
                    type="checkbox"
                    checked={autoAssign}
                    onChange={(e) => setAutoAssign(e.target.checked)}
                    className="accent-white"
                  />
                  Auto assign coordinates from dropdown selection
                </label>
                <form onSubmit={handleValidate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-neutral-400 mb-1">
                        Latitude
                      </label>
                      <input
                        type="text"
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-400 mb-1">
                        Longitude
                      </label>
                      <input
                        type="text"
                        value={lon}
                        onChange={(e) => setLon(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-800 space-y-2">
                    <label className="block text-[11px] text-neutral-400">
                      Provinsi
                    </label>
                    <select
                      value={selectedProvince}
                      onChange={(e) => handleProvinceChange(e.target.value)}
                      disabled={!autoAssign}
                      className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                    >
                      {INDONESIA_PROVINCES.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] text-neutral-400">
                      Kabupaten / Kota
                    </label>
                    <select
                      value={kabupatenKode}
                      disabled={testKabupatenList.length === 0 || !autoAssign}
                      onChange={(e) => handleKabupatenChange(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white disabled:opacity-50"
                    >
                      {testKabupatenList.map((k) => (
                        <option key={k.kode} value={k.kode}>
                          {k.nama}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] text-neutral-400">
                      Kecamatan
                    </label>
                    <select
                      value={kecamatanName}
                      disabled={kecamatans.length === 0 || !autoAssign}
                      onChange={(e) => handleKecamatanChange(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white disabled:opacity-50"
                    >
                      {kecamatans.map((k) => (
                        <option key={k.name} value={k.name}>
                          {k.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Clear location button */}
                  <div className="pt-2 mb-2">
                    <button
                      type="button"
                      onClick={handleClearLocation}
                      className="px-3 py-1 text-xs bg-neutral-800 text-neutral-200 border border-neutral-600 hover:bg-neutral-700"
                    >
                      Clear Provinsi/Kabupaten/Kecamatan
                    </button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-neutral-800">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold">
                      Expected Address Details
                    </span>
                    <input
                      type="text"
                      placeholder="Expected Road / Jl. ..."
                      value={expected.road}
                      onChange={(e) =>
                        setExpected({ ...expected, road: e.target.value })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Expected Kelurahan"
                        value={expected.village}
                        onChange={(e) =>
                          setExpected({ ...expected, village: e.target.value })
                        }
                        className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="Expected Kecamatan"
                        value={expected.district}
                        onChange={(e) =>
                          setExpected({ ...expected, district: e.target.value })
                        }
                        className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Expected Kota / Kabupaten"
                      value={expected.city}
                      onChange={(e) =>
                        setExpected({ ...expected, city: e.target.value })
                      }
                      className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                    />
                  </div>

                  {/* Pipeline Toggles */}
                  <div className="pt-3 border-t border-neutral-800 space-y-2 text-xs">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold">
                      Validation Pipeline Controls
                    </span>
                    <label className="flex items-center gap-2 text-neutral-300">
                      <input
                        type="checkbox"
                        checked={enableGIS}
                        onChange={(e) => setEnableGIS(e.target.checked)}
                        className="accent-white"
                      />
                      <span>Deterministic GIS Boundary</span>
                    </label>
                    <label className="flex items-center gap-2 text-neutral-300">
                      <input
                        type="checkbox"
                        checked={enableRoad}
                        onChange={(e) => setEnableRoad(e.target.checked)}
                        className="accent-white"
                      />
                      <span>Road-Level Distance & Name Check</span>
                    </label>
                    <label className="flex items-center gap-2 text-neutral-300">
                      <input
                        type="checkbox"
                        checked={enableAIArbitration}
                        onChange={(e) =>
                          setEnableAIArbitration(e.target.checked)
                        }
                        className="accent-white"
                      />
                      <span>
                        AI Cross-Match (Always — vs Enhanced Nominatim)
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-white text-black font-semibold uppercase py-2.5 text-xs tracking-wider hover:bg-neutral-200 transition disabled:opacity-50"
                  >
                    {loading ? "Executing Pipeline V2..." : "Run V2 Validation"}
                  </button>
                </form>
              </div>
            </div>

            {/* Evidence & Decision Result */}
            <div className="lg:col-span-2 space-y-6">
              {latestRecord ? (
                <div className="border border-neutral-800 bg-neutral-900/30 p-6 space-y-6">
                  {/* Status Banner */}
                  <div className="flex flex-wrap justify-between items-center border-b border-neutral-800 pb-4 gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 text-xs font-bold uppercase ${
                            latestRecord.aiValidation.status === "VALID"
                              ? "bg-green-950 text-green-400 border border-green-800"
                              : latestRecord.aiValidation.status ===
                                  "NEED_REVIEW"
                                ? "bg-amber-950 text-amber-400 border border-amber-800"
                                : "bg-red-950 text-red-400 border border-red-800"
                          }`}
                        >
                          {latestRecord.aiValidation.status}
                        </span>
                        <span className="text-xs text-neutral-400 border border-neutral-800 px-2 py-1">
                          Score: {latestRecord.aiValidation.confidenceScore}%
                        </span>
                        {latestRecord.evidence?.finalDecision?.determinedBy && (
                          <span className="text-[10px] text-neutral-400 border border-neutral-800 px-2 py-1 uppercase">
                            Engine:{" "}
                            {latestRecord.evidence.finalDecision.determinedBy}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        ID: {latestRecord.id} | {latestRecord.testedAt}
                      </p>
                    </div>
                  </div>

                  {/* 3 Pillars of Evidence */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* GIS Boundary Evidence */}
                    <div className="border border-neutral-800 p-4 space-y-2 bg-neutral-950">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-neutral-300 uppercase">
                          1. GIS Boundary Evidence
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.5 border border-neutral-700 text-neutral-400 uppercase">
                          Deterministic
                        </span>
                      </div>
                      {latestRecord.evidence?.gisValidation.available ? (
                        <div className="text-xs space-y-1.5 pt-1">
                          <p className="text-[11px] text-neutral-500">
                            Source: {latestRecord.evidence.gisValidation.source}{" "}
                            (v
                            {latestRecord.evidence.gisValidation.datasetVersion}
                            )
                          </p>
                          {latestRecord.evidence.gisValidation.comparisons.map(
                            (c) => (
                              <div
                                key={c.level}
                                className="flex justify-between items-center border-b border-neutral-900 pb-1"
                              >
                                <span className="capitalize text-neutral-400">
                                  {c.level}:
                                </span>
                                <span
                                  className={`text-[11px] font-bold ${c.match ? "text-green-400" : "text-red-400"}`}
                                >
                                  {c.nominatimValue || "(none)"} →{" "}
                                  {c.gisValue || "(none)"} [
                                  {c.match ? "MATCH" : "MISMATCH"}]
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500">
                          GIS layer unavailable.
                        </p>
                      )}
                    </div>

                    {/* Road Validation Evidence */}
                    <div className="border border-neutral-800 p-4 space-y-2 bg-neutral-950">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-neutral-300 uppercase">
                          2. Road-Level Evidence
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.5 border border-neutral-700 text-neutral-400 uppercase">
                          Deterministic
                        </span>
                      </div>
                      {latestRecord.evidence?.roadValidation.available ? (
                        <div className="text-xs space-y-1 pt-1">
                          <p>
                            <span className="text-neutral-500">Nominatim:</span>{" "}
                            {latestRecord.evidence.roadValidation
                              .nominatimRoad || "(none)"}
                          </p>
                          <p>
                            <span className="text-neutral-500">Expected:</span>{" "}
                            {latestRecord.evidence.roadValidation.matchedRoad ||
                              "(none)"}
                          </p>
                          <p>
                            <span className="text-neutral-500">
                              Similarity:
                            </span>{" "}
                            {Math.round(
                              latestRecord.evidence.roadValidation
                                .nameSimilarity * 100,
                            )}
                            %
                          </p>
                          <p>
                            <span className="text-neutral-500">Match:</span>{" "}
                            <span
                              className={
                                latestRecord.evidence.roadValidation.match
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              {latestRecord.evidence.roadValidation.match
                                ? "PASS"
                                : "ROAD MISMATCH"}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500">
                          Road validation skipped.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Polygon & Point Boundary Map Preview */}
                  <div className="border border-neutral-800 p-4 space-y-3 bg-neutral-950">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-neutral-300 uppercase">
                          GIS Polygon Boundary Map & Location Pin
                        </h3>
                        <p className="text-[10px] text-neutral-500">
                          Visualisasi polygon batas administratif wilayah &
                          posisi koordinat input
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Copy lat,lng Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const coordStr = `${latestRecord.coordinate.lat},${latestRecord.coordinate.lon}`;
                            navigator.clipboard.writeText(coordStr);
                            setCopiedCoord(true);
                            setTimeout(() => setCopiedCoord(false), 2000);
                          }}
                          className="px-2.5 py-1 text-[11px] bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-neutral-200 transition flex items-center gap-1.5"
                          title="Copy lat,lon to clipboard"
                        >
                          <span>
                            {latestRecord.coordinate.lat.toFixed(6)},{" "}
                            {latestRecord.coordinate.lon.toFixed(6)}
                          </span>
                          <span className="text-neutral-400 font-bold">
                            {copiedCoord ? "[Copied!]" : "[Copy Lat,Lng]"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Admin Level Filters */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-neutral-900">
                      <span className="text-[10px] text-neutral-500 uppercase">
                        Tampilkan Polygon:
                      </span>
                      {(
                        [
                          { key: "provinsi", label: "Provinsi" },
                          { key: "kabupaten", label: "Kabupaten" },
                          { key: "kecamatan", label: "Kecamatan" },
                        ] as const
                      ).map(({ key, label }) => {
                        const active = mapLevels.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setMapLevels((prev) =>
                                active
                                  ? prev.filter((k) => k !== key)
                                  : [...prev, key],
                              )
                            }
                            className={`px-2 py-0.5 text-[10px] uppercase border transition ${
                              active
                                ? "bg-white text-black border-white font-bold"
                                : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="pt-2">
                      <BoundaryMap
                        lat={latestRecord.coordinate.lat}
                        lon={latestRecord.coordinate.lon}
                        provinceName={
                          latestRecord.expectedAddress?.province ||
                          latestRecord.nominatimResult?.state ||
                          selectedProvince
                        }
                        levels={mapLevels}
                      />
                    </div>
                  </div>

                  {/* Cross-Match: AI vs Enhanced Nominatim */}
                  {latestRecord.evidence?.crossMatch && (
                    <div className="border border-neutral-800 p-4 space-y-3 bg-neutral-950">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-neutral-300 uppercase">
                          AI vs Enhanced Nominatim (Cross-Match)
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.5 border border-neutral-700 text-neutral-400 uppercase">
                          {latestRecord.evidence.crossMatch.allMatched
                            ? "AGREE"
                            : "CONFLICT"}{" "}
                          • {latestRecord.evidence.crossMatch.matchedLevels}/
                          {latestRecord.evidence.crossMatch.comparedLevels}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {latestRecord.evidence.crossMatch.comparisons.map(
                          (c) => (
                            <div
                              key={c.level}
                              className="grid grid-cols-[90px_1fr_1fr_auto] gap-2 items-center text-[11px] border-b border-neutral-900 pb-1.5"
                            >
                              <span className="capitalize text-neutral-500">
                                {c.level}
                              </span>
                              <div>
                                <span className="text-neutral-600 text-[9px] uppercase">
                                  AI{" "}
                                </span>
                                <span className="text-neutral-300">
                                  {c.aiValue || "—"}
                                </span>
                              </div>
                              <div>
                                <span className="text-neutral-600 text-[9px] uppercase">
                                  Enhanced{" "}
                                </span>
                                <span
                                  className={
                                    c.match
                                      ? "text-green-400"
                                      : "text-amber-400"
                                  }
                                >
                                  {c.enhancedValue || "—"}
                                </span>
                              </div>
                              <span
                                className={`text-[9px] font-bold uppercase ${
                                  c.match ? "text-green-400" : "text-red-400"
                                }`}
                              >
                                {c.match ? "MATCH" : c.conflictWith}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                      {latestRecord.evidence.enhancedAddress && (
                        <p className="text-[10px] text-neutral-600 pt-1">
                          Enhanced source:{" "}
                          {latestRecord.evidence.enhancedAddress.source || "—"}
                          {latestRecord.evidence.enhancedAddress.datasetVersion
                            ? ` (v${latestRecord.evidence.enhancedAddress.datasetVersion})`
                            : ""}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Decision Reason & Error Tags */}
                  <div className="border border-neutral-800 p-4 space-y-2 bg-neutral-950">
                    <h3 className="text-xs font-bold text-neutral-400 uppercase">
                      Pipeline Decision Audit & Reason
                    </h3>
                    <p className="text-xs text-neutral-300 bg-neutral-900/60 p-2.5 border border-neutral-800">
                      {latestRecord.evidence?.finalDecision?.reason ||
                        latestRecord.aiValidation.notes}
                    </p>
                    {latestRecord.aiValidation.errorTypes?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
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
                  Run a validation test on the left to inspect traceable GIS and
                  Road evidence.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CORRECTION LOGS & EVIDENCE */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
              Correction Log & Traceable Evidence Table
            </h2>
            <div className="border border-neutral-800 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400 uppercase">
                    <th className="p-3">Coordinate</th>
                    <th className="p-3">Nominatim Address</th>
                    <th className="p-3">GIS Match</th>
                    <th className="p-3">Road Match</th>
                    <th className="p-3">Errors</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-900/30">
                      <td className="p-3 text-neutral-400">
                        {r.coordinate.lat}, {r.coordinate.lon}
                      </td>
                      <td className="p-3 text-neutral-300">
                        {r.nominatimResult.road || "(no road)"},{" "}
                        {r.nominatimResult.village || "-"},{" "}
                        {r.nominatimResult.district || "-"}
                      </td>
                      <td className="p-3">
                        {r.evidence?.gisValidation.available ? (
                          <span
                            className={
                              r.evidence.gisValidation.allMatched
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            {r.evidence.gisValidation.allMatched
                              ? "MATCH"
                              : "MISMATCH"}
                          </span>
                        ) : (
                          <span className="text-neutral-500">N/A</span>
                        )}
                      </td>
                      <td className="p-3">
                        {r.evidence?.roadValidation.available ? (
                          <span
                            className={
                              r.evidence.roadValidation.match
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            {r.evidence.roadValidation.match
                              ? "MATCH"
                              : "WRONG"}
                          </span>
                        ) : (
                          <span className="text-neutral-500">N/A</span>
                        )}
                      </td>
                      <td className="p-3">
                        {r.aiValidation.errorTypes?.map((e) => (
                          <span
                            key={e}
                            className="inline-block text-[9px] px-1 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-400 mr-1"
                          >
                            {e}
                          </span>
                        ))}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 ${
                            r.aiValidation.status === "VALID"
                              ? "text-green-400 bg-green-950/40 border border-green-800"
                              : "text-red-400 bg-red-950/40 border border-red-800"
                          }`}
                        >
                          {r.aiValidation.status}
                        </span>
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

        {/* TAB 3: PROVINCE AI RECAP */}
        {activeTab === "recap" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Province Quality Ranking
              </h2>
              <div className="border border-neutral-800 divide-y divide-neutral-800 bg-neutral-900/30">
                {aggregates.map((agg) => (
                  <button
                    key={agg.province}
                    onClick={() => handleProvinceSelectForRecap(agg.province)}
                    className="w-full text-left p-3 hover:bg-neutral-900/60 transition flex justify-between items-center"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">
                        {agg.province}
                      </p>
                      <p className="text-[10px] text-neutral-500">
                        Tested: {agg.totalTested} | Valid: {agg.validCount}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs font-bold ${
                          agg.errorRate > 15 ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {agg.errorRate}% err
                      </span>
                    </div>
                  </button>
                ))}
                {aggregates.length === 0 && (
                  <div className="p-6 text-center text-xs text-neutral-600">
                    No aggregate data yet. Run validation tests first.
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Deterministic Aggregated AI Recap
              </h2>
              {recapLoading ? (
                <div className="border border-neutral-800 p-8 text-center text-xs text-neutral-500">
                  Generating aggregated AI quality recap...
                </div>
              ) : selectedRecap ? (
                <div className="border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase">
                        {selectedRecap.province} Quality Audit
                      </h3>
                      <p className="text-[10px] text-neutral-500">
                        Dataset: v{selectedRecap.datasetVersion} | Aggregation:{" "}
                        {selectedRecap.aggregationVersion}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold uppercase px-2 py-0.5 border ${
                        selectedRecap.priority === "CRITICAL"
                          ? "bg-red-950 text-red-400 border-red-800"
                          : selectedRecap.priority === "HIGH"
                            ? "bg-yellow-950 text-yellow-400 border-yellow-800"
                            : "bg-green-950 text-green-400 border-green-800"
                      }`}
                    >
                      Priority: {selectedRecap.priority}
                    </span>
                  </div>

                  <div className="text-xs space-y-2">
                    <p className="text-neutral-300 font-semibold">
                      {selectedRecap.summary}
                    </p>
                    <p className="text-neutral-400">
                      {selectedRecap.qualityAssessment}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="border border-neutral-800 p-3 bg-neutral-950 space-y-2">
                      <span className="text-[10px] uppercase font-bold text-neutral-500">
                        Major Problems (Facts)
                      </span>
                      <ul className="text-xs text-neutral-400 space-y-1 list-disc list-inside">
                        {selectedRecap.majorProblems.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="border border-neutral-800 p-3 bg-neutral-950 space-y-2">
                      <span className="text-[10px] uppercase font-bold text-neutral-500">
                        Recommended Improvements
                      </span>
                      <ul className="text-xs text-neutral-400 space-y-1 list-disc list-inside">
                        {selectedRecap.recommendedImprovements.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-neutral-800 p-8 text-center text-xs text-neutral-600">
                  Select a province on the left to inspect its aggregated AI
                  recap.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
