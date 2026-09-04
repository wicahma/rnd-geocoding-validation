"use client";

import { useState } from "react";
import Link from "next/link";
import { Coordinate, ExpectedAddress } from "@/types";
import { DIY_KABUPATEN, KECAMATAN_DIY } from "@/lib/kecamatan";

type Method = "e2e" | "gemini" | "nominatim";

const EXPECTED_DEFAULT: ExpectedAddress = {
  road: "",
  village: "",
  district: "",
  city: "",
  province: "Daerah Istimewa Yogyakarta",
  postcode: "",
};

interface GeminiResult {
  isValid: boolean;
  status: string;
  confidenceScore: number;
  errorTypes: string[];
  hierarchyConsistent: boolean;
  notes: string;
  expectedAddress: ExpectedAddress;
}

interface NominatimResult {
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

export default function Home() {
  const [method, setMethod] = useState<Method>("e2e");
  const [lat, setLat] = useState("-7.8495154");
  const [lon, setLon] = useState("110.3593989");
  const [kabupaten, setKabupaten] = useState("Bantul");
  const [kecamatanName, setKecamatanName] = useState("Sewon");
  const [expected, setExpected] = useState<ExpectedAddress>(EXPECTED_DEFAULT);
  const [sourceText, setSourceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [geminiResult, setGeminiResult] = useState<GeminiResult | null>(null);
  const [nominatimResult, setNominatimResult] =
    useState<NominatimResult | null>(null);
  const [lastPrompt, setLastPrompt] = useState("");

  const kecamatans = KECAMATAN_DIY[kabupaten] ?? [];

  const applyKecamatan = (name: string) => {
    const k = kecamatans.find((x) => x.name === name);
    if (k) {
      setLat(k.lat.toFixed(6));
      setLon(k.lon.toFixed(6));
      setExpected((prev) => ({
        ...prev,
        district: k.name,
        city: kabupaten,
        province: EXPECTED_DEFAULT.province,
      }));
    }
  };

  const setKab = (kab: string) => {
    setKabupaten(kab);
    const first = KECAMATAN_DIY[kab][0];
    setKecamatanName(first.name);
    setLat(first.lat.toFixed(6));
    setLon(first.lon.toFixed(6));
    setExpected((prev) => ({
      ...prev,
      district: first.name,
      city: kab,
      province: EXPECTED_DEFAULT.province,
    }));
  };

  const selectKecamatan = (name: string) => {
    setKecamatanName(name);
    applyKecamatan(name);
  };

  const handleGemini = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setGeminiResult(null);
    try {
      const res = await fetch("/api/manual/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinate: { lat: parseFloat(lat), lon: parseFloat(lon) },
          sourceText,
          expected: hasExpectedData(expected) ? expected : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gemini check failed");
      }
      const data = await res.json();
      setGeminiResult(data.aiValidation);
      setLastPrompt(data.prompt);
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
      else setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleNominatim = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setNominatimResult(null);
    try {
      const res = await fetch("/api/manual/nominatim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinate: { lat: parseFloat(lat), lon: parseFloat(lon) },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Nominatim check failed");
      }
      const data = await res.json();
      setNominatimResult(data.reverseGeocoded);
    } catch (err: unknown) {
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
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase">
            GeoMaps Nominatim Quality Enhancement Pipeline
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Berijalan Address Cleansing &amp; Verified Location Data Asset —
            Pilih Metode Pengecekan
          </p>
        </header>

        {errorMsg && (
          <div className="p-4 bg-red-950/50 border border-red-800 text-red-200 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Method selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(
            [
              {
                id: "e2e",
                title: "Default — End to End",
                desc: "Nominatim → Gemini → simpan ke correction log",
                href: "/pipeline",
              },
              {
                id: "gemini",
                title: "Manual — Gemini Validation",
                desc: "Kirim koordinat / teks ke Gemini saja",
              },
              {
                id: "nominatim",
                title: "Manual — Nominatim Check",
                desc: "Reverse geocode koordinat via Nominatim saja",
              },
            ] as { id: Method; title: string; desc: string; href?: string }[]
          ).map((m) =>
            m.href ? (
              <Link
                key={m.id}
                href={m.href}
                className="block border border-neutral-800 bg-neutral-900/50 p-6 hover:border-white hover:bg-neutral-800/50 transition"
              >
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  {m.title}
                </h2>
                <p className="text-xs text-neutral-400 mt-2">{m.desc}</p>
                <p className="text-xs text-white mt-4 uppercase">
                  Buka Pipeline →
                </p>
              </Link>
            ) : (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`text-left border p-6 transition ${
                  method === m.id
                    ? "border-white bg-neutral-800/50"
                    : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-600"
                }`}
              >
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  {m.title}
                </h2>
                <p className="text-xs text-neutral-400 mt-2">{m.desc}</p>
                {method === m.id && (
                  <p className="text-xs text-green-400 mt-4 uppercase">
                    ● Terpilih
                  </p>
                )}
              </button>
            ),
          )}
        </div>

        {/* Auto-input controls (manual methods only) */}
        {(method === "gemini" || method === "nominatim") && (
          <div className="border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
              Auto-Input Target (DI Yogyakarta)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">
                  Kabupaten / Kota
                </label>
                <select
                  value={kabupaten}
                  onChange={(e) => setKab(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                >
                  {DIY_KABUPATEN.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">
                  Kecamatan (auto-isi lat/lon + expected)
                </label>
                <select
                  value={kecamatanName}
                  onChange={(e) => selectKecamatan(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                >
                  {kecamatans.map((k) => (
                    <option key={k.name} value={k.name}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">
                  Latitude
                </label>
                <input
                  type="text"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
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
                  className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Manual Gemini */}
        {method === "gemini" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <form onSubmit={handleGemini} className="space-y-4">
              <div className="border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                  Payload Manual (format sama dengan pipeline)
                </h2>
                <div className="space-y-2">
                  <p className="text-xs text-neutral-400">
                    Expected Address (ground truth)
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
                <div className="space-y-2 pt-2 border-t border-neutral-800">
                  <p className="text-xs text-neutral-400">
                    Source Text opsional — kosongkan untuk pakai prompt default
                    (koordinat + expected, tanpa hasil Nominatim)
                  </p>
                  <textarea
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    rows={5}
                    placeholder="NOMINATIM RESULT:\n- Road: ...\n- Kelurahan/Desa: ..."
                    className="w-full bg-neutral-950 border border-neutral-800 p-2 text-xs text-white resize-y"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black font-semibold uppercase py-2.5 text-xs tracking-wider hover:bg-neutral-200 transition disabled:opacity-50"
                >
                  {loading ? "Mengirim ke Gemini..." : "Send to Gemini"}
                </button>
              </div>
            </form>

            <div className="border border-neutral-800 bg-neutral-900/40 p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                Hasil Gemini
              </h2>
              {geminiResult ? (
                <div className="space-y-3 text-xs">
                  <div className="flex gap-2">
                    <span
                      className={`px-3 py-1 font-bold uppercase ${statusClass(
                        geminiResult.status,
                      )}`}
                    >
                      {geminiResult.status}
                    </span>
                    <span className="text-neutral-400 border border-neutral-800 px-2 py-1">
                      Confidence: {geminiResult.confidenceScore}%
                    </span>
                  </div>
                  <p className="bg-neutral-950 p-3 border border-neutral-800 text-neutral-300">
                    {geminiResult.notes}
                  </p>
                  {geminiResult.errorTypes?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {geminiResult.errorTypes.map((err) => (
                        <span
                          key={err}
                          className="text-[10px] uppercase font-semibold px-2 py-0.5 bg-red-950/60 border border-red-800 text-red-300"
                        >
                          {err}
                        </span>
                      ))}
                    </div>
                  )}
                  {lastPrompt && (
                    <div>
                      <p className="text-neutral-400 font-semibold uppercase mb-1">
                        Prompt terkirim
                      </p>
                      <pre className="bg-neutral-950 border border-neutral-800 p-3 text-neutral-400 whitespace-pre-wrap">
                        {lastPrompt}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-neutral-600 text-xs">
                  Jalankan pengecekan untuk melihat hasil Gemini.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Manual Nominatim */}
        {method === "nominatim" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <form onSubmit={handleNominatim} className="space-y-4">
              <div className="border border-neutral-800 bg-neutral-900/50 p-6">
                <p className="text-xs text-neutral-400 mb-4">
                  Reverse geocode koordinat di atas via Nominatim (tanpa Gemini,
                  tanpa simpan record)
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black font-semibold uppercase py-2.5 text-xs tracking-wider hover:bg-neutral-200 transition disabled:opacity-50"
                >
                  {loading ? "Mengecek Nominatim..." : "Check Nominatim"}
                </button>
              </div>
            </form>

            <div className="border border-neutral-800 bg-neutral-900/40 p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
                Hasil Nominatim
              </h2>
              {nominatimResult ? (
                <div className="text-xs space-y-1">
                  <p>
                    <span className="text-neutral-500">Display:</span>{" "}
                    {nominatimResult.displayName}
                  </p>
                  <p>
                    <span className="text-neutral-500">Road:</span>{" "}
                    {nominatimResult.road || "-"}
                  </p>
                  <p>
                    <span className="text-neutral-500">Kelurahan:</span>{" "}
                    {nominatimResult.village || "-"}
                  </p>
                  <p>
                    <span className="text-neutral-500">Kecamatan:</span>{" "}
                    {nominatimResult.district || "-"}
                  </p>
                  <p>
                    <span className="text-neutral-500">Kota:</span>{" "}
                    {nominatimResult.city || "-"}
                  </p>
                  <p>
                    <span className="text-neutral-500">Provinsi:</span>{" "}
                    {nominatimResult.state || "-"}
                  </p>
                  <p>
                    <span className="text-neutral-500">Postal Code:</span>{" "}
                    {nominatimResult.postcode || "-"}
                  </p>
                </div>
              ) : (
                <p className="text-neutral-600 text-xs">
                  Jalankan pengecekan untuk melihat hasil Nominatim.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function statusClass(status: string): string {
  if (status === "VALID")
    return "bg-green-950 text-green-400 border border-green-800";
  if (status === "INCORRECT")
    return "bg-red-950 text-red-400 border border-red-800";
  return "bg-yellow-950 text-yellow-400 border border-yellow-800";
}
