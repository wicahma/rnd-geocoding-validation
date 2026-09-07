"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AdminLevel, LayerKey } from "@/lib/map/data";
import { colorForCode, layerProps } from "@/lib/map/colors";

const BoundaryMap = dynamic(() => import("@/components/map/BoundaryMap"), {
  ssr: false,
});

const LEVELS: { key: AdminLevel; label: string }[] = [
  { key: "provinsi", label: "Provinsi" },
  { key: "kabupaten", label: "Kabupaten" },
  { key: "kecamatan", label: "Kecamatan" },
];

const LAYER_LABEL: Record<LayerKey, string> = {
  province: "Provinsi",
  city: "Kabupaten",
  district: "Kecamatan",
};

export default function BoundaryMapPage() {
  const [lat, setLat] = useState("-6.2146");
  const [lon, setLon] = useState("106.84851");
  const [levels, setLevels] = useState<AdminLevel[]>([
    "provinsi",
    "kabupaten",
    "kecamatan",
  ]);
  const [copied, setCopied] = useState("");
  const [provinceName, setProvinceName] = useState(
    "Daerah Khusus Ibukota Jakarta",
  );

  const applyPoint = (l: string, n: string) => {
    setLat(l);
    setLon(n);
    setCopied("");
  };

  // Resolve province name from marker once it's centered; allow manual edit.
  const numLat = parseFloat(lat) || 0;
  const numLon = parseFloat(lon) || 0;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-10 font-mono">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="border-b border-neutral-800 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-neutral-100 text-black uppercase">
                Boundary Map
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white uppercase">
                Shapefile Polygon Visualization (OSM)
              </h1>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Provinsi / Kabupaten / Kecamatan — point-in-polygon resolution
              dari coordinate marker
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="px-3 py-1.5 text-xs border border-neutral-800 hover:border-neutral-600 text-neutral-400"
            >
              Manual Test
            </Link>
            <Link
              href="/pipeline-v2"
              className="px-3 py-1.5 text-xs border border-neutral-800 hover:border-neutral-600 text-neutral-400"
            >
              V2 Pipeline
            </Link>
          </div>
        </header>

        {/* Controls */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
            <h2 className="text-xs uppercase text-neutral-400">
              Coordinate & Layers
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] uppercase text-neutral-500">
                  Latitude
                </span>
                <input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 p-2 text-sm text-white"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase text-neutral-500">
                  Longitude
                </span>
                <input
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 p-2 text-sm text-white"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => applyPoint("-6.2146", "106.84851")}
                className="px-2 py-1 text-[11px] border border-neutral-700 hover:border-neutral-500 text-neutral-300"
              >
                Monas (DKI)
              </button>
              <button
                onClick={() => applyPoint("-6.9175", "107.6191")}
                className="px-2 py-1 text-[11px] border border-neutral-700 hover:border-neutral-500 text-neutral-300"
              >
                Bandung
              </button>
              <button
                onClick={() => applyPoint("-7.2575", "112.7521")}
                className="px-2 py-1 text-[11px] border border-neutral-700 hover:border-neutral-500 text-neutral-300"
              >
                Surabaya
              </button>
            </div>
            <div>
              <span className="text-[10px] uppercase text-neutral-500 block mb-2">
                Layer yang ditampilkan
              </span>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((lv) => {
                  const on = levels.includes(lv.key);
                  return (
                    <button
                      key={lv.key}
                      onClick={() =>
                        setLevels((prev) =>
                          on
                            ? prev.filter((x) => x !== lv.key)
                            : [...prev, lv.key],
                        )
                      }
                      className={`px-3 py-1.5 text-xs border ${
                        on
                          ? "bg-white text-black border-white"
                          : "bg-neutral-900 border-neutral-700 text-neutral-400"
                      }`}
                    >
                      {lv.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="block">
              <span className="text-[10px] uppercase text-neutral-500">
                Nama Provinsi (untuk outline)
              </span>
              <input
                value={provinceName}
                onChange={(e) => setProvinceName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 p-2 text-sm text-white"
              />
            </label>
          </div>

          {/* Legend */}
          <div className="border border-neutral-800 bg-neutral-900/40 p-4">
            <h2 className="text-xs uppercase text-neutral-400 mb-3">
              Legenda Warna (hash kode admin)
            </h2>
            {(["province", "city", "district"] as LayerKey[]).map((lk) => {
              const p = layerProps[lk];
              const sample = ["11", "31.74", "31.74.01"];
              const code = sample[["province", "city", "district"].indexOf(lk)];
              return (
                <div
                  key={lk}
                  className="flex items-center gap-3 py-1 border-b border-neutral-800/60 last:border-0"
                >
                  <span
                    className="w-5 h-5 shrink-0 border"
                    style={{
                      backgroundColor: colorForCode(code, lk),
                      borderColor: p.color,
                    }}
                  />
                  <div className="flex-1 text-xs">
                    <span className="font-semibold uppercase text-neutral-300">
                      {LAYER_LABEL[lk]}
                    </span>
                    <span className="text-neutral-500 ml-2">
                      fillOpacity {p.fillOpacity} · stroke {p.color}
                    </span>
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-neutral-500 mt-3">
              Warna poligon deterministik dari kode BPS —
              provinsi/kabupaten/kecamatan diwarnai berbeda. Hover poligon untuk
              nama & kode.
            </p>
          </div>
        </div>

        {/* Map */}
        <BoundaryMap
          lat={numLat}
          lon={numLon}
          provinceName={provinceName}
          levels={levels}
        />

        {/* Copy resolved codes */}
        <div className="border border-neutral-800 bg-neutral-900/40 p-4">
          <h2 className="text-xs uppercase text-neutral-400 mb-2">
            Resolved Admin Codes
          </h2>
          <MapCodeCopy
            copied={copied}
            setCopied={setCopied}
            lat={numLat}
            lon={numLon}
          />
        </div>
      </div>
    </main>
  );
}

function MapCodeCopy({
  copied,
  setCopied,
  lat,
  lon,
}: {
  copied: string;
  setCopied: (v: string) => void;
  lat: number;
  lon: number;
}) {
  const [res, setRes] = useState<Record<LayerKey, string>>({
    province: "",
    city: "",
    district: "",
  });
  useEffect(() => {
    let alive = true;
    async function load() {
      const mod = await import("@/lib/map/data");
      const r = await mod.resolveAt(lon, lat);
      if (!alive) return;
      setRes({
        province: r.province ? `${r.province.kode} · ${r.province.nama}` : "—",
        city: r.city ? `${r.city.kode} · ${r.city.nama}` : "—",
        district: r.district ? `${r.district.kode} · ${r.district.nama}` : "—",
      });
    }
    load();
    return () => {
      alive = false;
    };
  }, [lat, lon]);
  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(v);
    } catch {
      setCopied("");
    }
  };
  return (
    <div className="grid md:grid-cols-3 gap-3">
      {(["province", "city", "district"] as LayerKey[]).map((lk) => (
        <div
          key={lk}
          className="border border-neutral-800 bg-neutral-950/50 p-2 text-xs"
        >
          <div className="text-[10px] uppercase text-neutral-500">
            {LAYER_LABEL[lk]}
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="font-mono text-neutral-200 truncate">
              {res[lk] || "loading…"}
            </span>
            <button
              onClick={() => copy(res[lk]?.split(" · ")[0] || "")}
              className="shrink-0 px-1.5 py-0.5 text-[10px] border border-neutral-600 hover:border-neutral-400 text-neutral-400"
            >
              {copied === res[lk]?.split(" · ")[0] ? "✓" : "copy"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
