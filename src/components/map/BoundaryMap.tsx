"use client";

import { useEffect, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PolygonLayer from "@/components/map/PolygonLayer";
import {
  AdminLevel,
  BoundaryFeature,
  LayerKey,
  loadBoundaries,
  resolveAt,
} from "@/lib/map/data";

interface Props {
  lat: number;
  lon: number;
  provinceName: string;
  levels: AdminLevel[];
  accuracy?: number;
}

const darkTile = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const attribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function FitToContent({
  bbox,
  center,
}: {
  bbox?: [number, number, number, number];
  center: [number, number];
}) {
  const map = useMap();
  useEffect(() => {
    if (bbox) {
      map.fitBounds(
        [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]],
        ],
        { padding: [24, 24] },
      );
    } else {
      map.setView(center, 7);
    }
  }, [bbox, center, map]);
  return null;
}

export default function BoundaryMap({
  lat,
  lon,
  provinceName,
  levels,
  accuracy,
}: Props) {
  const [province, setProvince] = useState<BoundaryFeature | undefined>();
  const [cities, setCities] = useState<BoundaryFeature[]>([]);
  const [districts, setDistricts] = useState<BoundaryFeature[]>([]);
  const [hit, setHit] = useState<Record<LayerKey, BoundaryFeature | undefined>>(
    {
      province: undefined,
      city: undefined,
      district: undefined,
    },
  );
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState<{
    loading: boolean;
    boundariesLoaded: boolean;
    totalProvinces: number;
    totalCities: number;
    totalDistricts: number;
    provinceFound: boolean;
    provinceCode: string;
    citiesCount: number;
    districtsCount: number;
    resolvedProvince?: string;
    resolvedCity?: string;
    resolvedDistrict?: string;
  }>({
    loading: true,
    boundariesLoaded: false,
    totalProvinces: 0,
    totalCities: 0,
    totalDistricts: 0,
    provinceFound: false,
    provinceCode: "",
    citiesCount: 0,
    districtsCount: 0,
  });
  const runId = useRef(0);

  useEffect(() => {
    const id = ++runId.current;
    const key: LayerKey[] = ["province", "city", "district"];
    const layerKey = new Set(key);

    setDebugInfo((prev) => ({ ...prev, loading: true }));

    // Show province outlines, then cities/districts nested under it.
    Promise.all([loadBoundaries(), resolveAt(lon, lat)])
      .then(([b, res]) => {
        if (id !== runId.current) return;

        console.log("[BoundaryMap] Boundaries loaded:", {
          provinces: b.province.length,
          cities: b.city.length,
          districts: b.district.length,
          cityByProvinceKeys: Array.from(b.cityByProvince.keys()),
        });

        setHit(res);

        const prov = b.province.find((f) => f.nama === provinceName);
        console.log(
          "[BoundaryMap] Looking for province:",
          provinceName,
          "Found:",
          !!prov,
          prov?.kode,
        );

        if (!prov) {
          setError(`Provinsi "${provinceName}" tidak ditemukan di shapefile.`);
          setDebugInfo((prev) => ({
            ...prev,
            loading: false,
            boundariesLoaded: true,
            totalProvinces: b.province.length,
            totalCities: b.city.length,
            totalDistricts: b.district.length,
            provinceFound: false,
          }));
          return;
        }

        const pCode = prov.kode.split(".")[0];
        setProvince(prov);

        // When the marker sits inside the chosen province show the full
        // hierarchy; otherwise show only the chosen province outline.
        if (res.province?.kode !== prov.kode) {
          setCities([]);
          setDistricts([]);
          setError(
            `Koordinat berada di ${res.province?.nama || "luar Indonesia"}, bukan ${provinceName} — menampilkan outline provinsi yang dipilih.`,
          );
          setDebugInfo((prev) => ({
            ...prev,
            loading: false,
            boundariesLoaded: true,
            totalProvinces: b.province.length,
            totalCities: b.city.length,
            totalDistricts: b.district.length,
            provinceFound: true,
            provinceCode: prov.kode,
            citiesCount: 0,
            districtsCount: 0,
            resolvedProvince: res.province?.nama,
          }));
          return;
        }

        const relevant = new Set<LayerKey>([...layerKey]);
        if (!levels.includes("kabupaten")) relevant.delete("city");
        if (!levels.includes("kecamatan")) relevant.delete("district");

        const cityList = relevant.has("city")
          ? b.cityByProvince.get(pCode) || []
          : [];
        const distList = relevant.has("district")
          ? cityList.flatMap((c) => b.districtByCity.get(c.kode) || [])
          : [];

        console.log("[BoundaryMap] City/District loading:", {
          pCode,
          levels,
          relevant: Array.from(relevant),
          cityListCount: cityList.length,
          distListCount: distList.length,
        });

        setCities(cityList);
        setDistricts(distList);
        setError("");

        setDebugInfo({
          loading: false,
          boundariesLoaded: true,
          totalProvinces: b.province.length,
          totalCities: b.city.length,
          totalDistricts: b.district.length,
          provinceFound: true,
          provinceCode: prov.kode,
          citiesCount: cityList.length,
          districtsCount: distList.length,
          resolvedProvince: res.province?.nama,
          resolvedCity: res.city?.nama,
          resolvedDistrict: res.district?.nama,
        });
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        console.error("[BoundaryMap] Error:", e);
        setDebugInfo((prev) => ({ ...prev, loading: false }));
      });

    return () => {
      runId.current++;
    };
  }, [lat, lon, provinceName, levels]);

  const bbox = province?.bbox;
  return (
    <>
      {/* Debug Info Panel - Values passed to Map */}
      <div className="border border-neutral-800 bg-neutral-950/60 p-3 space-y-2 text-[10px] font-mono">
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-1.5">
          <span className="text-neutral-400 uppercase font-bold">
            🗺️ Map Debug Info
          </span>
          {debugInfo.loading && (
            <span className="text-amber-400 animate-pulse">LOADING...</span>
          )}
        </div>

        {/* Input Props */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <span className="text-neutral-500 block">Input Lat:</span>
            <span className="text-white font-bold">{lat.toFixed(6)}</span>
          </div>
          <div>
            <span className="text-neutral-500 block">Input Lon:</span>
            <span className="text-white font-bold">{lon.toFixed(6)}</span>
          </div>
          <div>
            <span className="text-neutral-500 block">Province Name:</span>
            <span className="text-white font-bold truncate block">
              {provinceName}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block">Levels:</span>
            <span className="text-white font-bold">{levels.join(", ")}</span>
          </div>
        </div>

        {/* Boundaries Data */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-neutral-900">
          <div>
            <span className="text-neutral-500 block">Total Provinces:</span>
            <span className="text-blue-400 font-bold">
              {debugInfo.totalProvinces}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block">Total Cities:</span>
            <span className="text-blue-400 font-bold">
              {debugInfo.totalCities}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block">Total Districts:</span>
            <span className="text-blue-400 font-bold">
              {debugInfo.totalDistricts}
            </span>
          </div>
        </div>

        {/* Resolved & Rendered */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 border-t border-neutral-900">
          <div>
            <span className="text-neutral-500 block">Province Found:</span>
            <span
              className={`font-bold ${debugInfo.provinceFound ? "text-green-400" : "text-red-400"}`}
            >
              {debugInfo.provinceFound ? "YES" : "NO"}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block">Province Code:</span>
            <span className="text-cyan-400 font-bold">
              {debugInfo.provinceCode || "—"}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block">Cities to Render:</span>
            <span className="text-green-400 font-bold">
              {debugInfo.citiesCount}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block">Districts to Render:</span>
            <span className="text-green-400 font-bold">
              {debugInfo.districtsCount}
            </span>
          </div>
        </div>

        {/* Resolved from Point-in-Polygon */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-neutral-900">
          <div>
            <span className="text-neutral-500 block">Resolved Province:</span>
            <span className="text-amber-300 font-bold truncate block">
              {debugInfo.resolvedProvince || "—"}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block">Resolved City:</span>
            <span className="text-amber-300 font-bold truncate block">
              {debugInfo.resolvedCity || "—"}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block">Resolved District:</span>
            <span className="text-amber-300 font-bold truncate block">
              {debugInfo.resolvedDistrict || "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <MapContainer
          center={[lat, lon]}
          zoom={7}
          scrollWheelZoom
          className="w-full h-135 z-0"
          zoomControl={false}
        >
          <TileLayer url={darkTile} attribution={attribution} />
          <ZoomControl position="bottomright" />
          <FitToContent bbox={bbox} center={[lat, lon]} />

          <PolygonLayer
            layer="province"
            features={province ? [province] : []}
          />
          {levels.includes("kabupaten") && (
            <PolygonLayer layer="city" features={cities} />
          )}
          {levels.includes("kecamatan") && (
            <PolygonLayer layer="district" features={districts} />
          )}

          <CircleMarker
            center={[lat, lon]}
            radius={6}
            pathOptions={{
              color: "#fbbf24",
              weight: 2,
              fillColor: "#f59e0b",
              fillOpacity: 1,
            }}
          ></CircleMarker>
        </MapContainer>

        {error && (
          <div className="p-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-800">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 px-1">
          <Info
            label="Lat, Lon"
            value={`${lat.toFixed(5)}, ${lon.toFixed(5)}`}
          />
          <Info
            label="Resolved Provinsi"
            value={hit.province ? hit.province.nama : "—"}
            ok={!!hit.province}
          />
          <Info
            label="Resolved Kabupaten"
            value={hit.city ? hit.city.nama : "—"}
            ok={!!hit.city}
          />
          <Info
            label="Resolved Kecamatan"
            value={hit.district ? hit.district.nama : "—"}
            ok={!!hit.district}
          />
          <Info
            label="Kode Prov/Kab/Kec"
            value={`${hit.province?.kode || "—"} / ${hit.city?.kode || "—"} / ${hit.district?.kode || "—"}`}
          />
          <Info
            label="Akurasi (m)"
            value={accuracy != null ? accuracy.toLocaleString("id-ID") : "—"}
          />
        </div>
      </div>
    </>
  );
}

function Info({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="border border-neutral-800 bg-neutral-900/40 p-2">
      <div className="text-[10px] uppercase text-neutral-500">{label}</div>
      <div
        className={`text-xs font-medium truncate ${ok === false ? "text-amber-400" : "text-neutral-200"}`}
      >
        {value}
      </div>
    </div>
  );
}
