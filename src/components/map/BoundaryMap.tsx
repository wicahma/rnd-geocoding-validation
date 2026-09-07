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

const darkTile =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const attribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Fit map bounds to the loaded province + marker. */
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
  const runId = useRef(0);

  useEffect(() => {
    const id = ++runId.current;
    const key: LayerKey[] = ["province", "city", "district"];
    const layerKey = new Set(key);

    // Show province outlines, then cities/districts nested under it.
    Promise.all([loadBoundaries(), resolveAt(lon, lat)])
      .then(([b, res]) => {
        if (id !== runId.current) return;
        setHit(res);
        const prov = b.province.find((f) => f.nama === provinceName);
        if (!prov) {
          setError(`Provinsi "${provinceName}" tidak ditemukan di shapefile.`);
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
        setCities(cityList);
        setDistricts(distList);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      runId.current++;
    };
  }, [lat, lon, provinceName, levels]);

  const bbox = province?.bbox;
  return (
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

        <PolygonLayer layer="province" features={province ? [province] : []} />
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
        >
          {/* marker popup content handled below */}
        </CircleMarker>
      </MapContainer>

      {error && (
        <div className="p-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-800">
          {error}
        </div>
      )}

      {/* Marker pin info + resolved hierarchy */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 px-1">
        <Info label="Lat, Lon" value={`${lat.toFixed(5)}, ${lon.toFixed(5)}`} />
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
