"use client";

export type AdminLevel = "provinsi" | "kabupaten" | "kecamatan";
export type LayerKey = "province" | "city" | "district";

export interface BoundaryFeature {
  kode: string;
  nama: string;
  polygons: [number, number][][][];
  bbox: [number, number, number, number];
}

interface RawFC {
  features: {
    properties: { kode: string; nama: string };
    geometry: {
      type: string;
      coordinates: [number, number][][][];
    };
  }[];
}

const toFeatures = (raw: unknown): BoundaryFeature[] =>
  ((raw as RawFC).features || []).map((f) => {
    const coords = f.geometry?.coordinates || [];
    const polys = Array.isArray(coords[0]?.[0]?.[0])
      ? coords
      : ([coords] as unknown as [number, number][][][]);
    const pts = polys.flat(2);
    const lons = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    return {
      kode: f.properties?.kode || "",
      nama: f.properties?.nama || "",
      polygons: polys,
      bbox: [
        Math.min(...lons),
        Math.min(...lats),
        Math.max(...lons),
        Math.max(...lats),
      ],
    };
  });

interface BoundaryCache {
  province: BoundaryFeature[];
  city: BoundaryFeature[];
  district: BoundaryFeature[];
  cityByProvince: Map<string, BoundaryFeature[]>;
  districtByCity: Map<string, BoundaryFeature[]>;
}

let cache: BoundaryCache | null = null;

/** Load all boundary layers lazily (single download per dataset). */
export async function loadBoundaries(): Promise<BoundaryCache> {
  if (cache) return cache;
  const [provRaw, cityRaw, distRaw] = await Promise.all([
    import("@/data/boundaries/provinsi.json"),
    import("@/data/boundaries/kabupaten.json"),
    import("@/data/boundaries/kecamatan.json"),
  ]);
  const province = toFeatures(provRaw);
  const city = toFeatures(cityRaw);
  const district = toFeatures(distRaw);
  const cityByProvince = new Map<string, BoundaryFeature[]>();
  for (const c of city) {
    const provCode = c.kode.split(".")[0];
    const list = cityByProvince.get(provCode) || [];
    list.push(c);
    cityByProvince.set(provCode, list);
  }
  const districtByCity = new Map<string, BoundaryFeature[]>();
  for (const d of district) {
    const cityCode = d.kode.split(".").slice(0, 2).join(".");
    const list = districtByCity.get(cityCode) || [];
    list.push(d);
    districtByCity.set(cityCode, list);
  }
  cache = { province, city, district, cityByProvince, districtByCity };
  return cache;
}

const pointInPolygon = (pt: [number, number], vs: [number, number][]) => {
  const x = pt[0];
  const y = pt[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const [xi, yi] = vs[i];
    const [xj, yj] = vs[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const inBBox = (f: BoundaryFeature, lon: number, lat: number) => {
  const [minLon, minLat, maxLon, maxLat] = f.bbox;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
};

const inFeature = (f: BoundaryFeature, lon: number, lat: number) => {
  if (!inBBox(f, lon, lat)) return false;
  for (const poly of f.polygons) {
    let current = false;
    for (const ring of poly) {
      if (pointInPolygon([lon, lat], ring)) current = !current;
    }
    if (current) return true;
  }
  return false;
};

/** Resolve province -> city -> district codes/names at a coordinate. */
export async function resolveAdminHierarchyAt(
  lon: number,
  lat: number,
): Promise<{
  province?: BoundaryFeature;
  city?: BoundaryFeature;
  district?: BoundaryFeature;
}> {
  const b = await loadBoundaries();
  const hit = (list: BoundaryFeature[]) =>
    list.filter((f) => inBBox(f, lon, lat));
  const provHits = hit(b.province).filter((f) => inFeature(f, lon, lat));
  if (provHits.length === 0) return {};
  const prov = provHits.sort(
    (a, z) => a.polygons.length - z.polygons.length,
  )[0];
  const cityHits = (b.cityByProvince.get(prov.kode) || []).filter((f) =>
    inFeature(f, lon, lat),
  );
  let city: BoundaryFeature | undefined;
  if (cityHits.length > 0) {
    city = cityHits.sort((a, z) => a.polygons.length - z.polygons.length)[0];
  }
  const districtHits = city
    ? (b.districtByCity.get(city.kode) || []).filter((f) =>
        inFeature(f, lon, lat),
      )
    : [];
  let district: BoundaryFeature | undefined;
  if (districtHits.length > 0) {
    district = districtHits.sort(
      (a, z) => a.polygons.length - z.polygons.length,
    )[0];
  }
  return { province: prov, city, district };
}

/** Resolve features at a single lat/lon for the map. */
export async function resolveAt(
  lon: number,
  lat: number,
): Promise<Record<LayerKey, BoundaryFeature | undefined>> {
  const r = await resolveAdminHierarchyAt(lon, lat);
  return {
    province: r.province,
    city: r.city,
    district: r.district,
  };
}
