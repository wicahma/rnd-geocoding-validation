import { Coordinate } from "@/types";
import { PROVINSI } from "./wilayah";

const PROVINCE_BOUNDS: Record<string, [number, number, number, number]> = {
  Aceh: [2.0, 95.5, 5.5, 98.0],
  "Sumatera Utara": [0.5, 97.5, 3.5, 100.5],
  "Sumatera Barat": [-2.5, 98.0, 0.5, 101.5],
  Riau: [-1.0, 100.5, 2.0, 104.0],
  Jambi: [-2.5, 101.5, -0.5, 104.5],
  "Sumatera Selatan": [-4.5, 102.5, -1.0, 106.0],
  Bengkulu: [-5.0, 101.0, -2.0, 103.5],
  Lampung: [-5.5, 103.5, -3.0, 106.0],
  "Kepulauan Bangka Belitung": [-3.5, 105.0, -1.0, 108.0],
  "Kepulauan Riau": [-1.0, 103.5, 2.0, 106.5],
  "Daerah Khusus Ibukota Jakarta": [-6.4, 106.7, -6.0, 107.0],
  "Jawa Barat": [-7.5, 105.5, -5.5, 108.8],
  Banten: [-7.0, 105.0, -5.0, 106.8],
  "Jawa Tengah": [-8.0, 108.5, -6.0, 111.5],
  "Daerah Istimewa Yogyakarta": [-8.2, 110.0, -7.5, 110.8],
  "Jawa Timur": [-8.8, 111.0, -6.5, 114.8],
  Bali: [-8.8, 114.4, -8.0, 115.7],
  "Nusa Tenggara Barat": [-9.2, 115.8, -8.0, 119.0],
  "Nusa Tenggara Timur": [-11.0, 118.5, -8.0, 125.0],
  "Kalimantan Barat": [-2.5, 108.5, 2.0, 114.5],
  "Kalimantan Tengah": [-3.5, 110.5, -0.5, 115.0],
  "Kalimantan Selatan": [-4.5, 114.5, -2.0, 116.5],
  "Kalimantan Timur": [-2.5, 115.0, 2.5, 119.0],
  "Kalimantan Utara": [1.5, 116.0, 4.5, 118.0],
  "Sulawesi Utara": [0.5, 123.5, 4.5, 126.5],
  Gorontalo: [0.3, 121.5, 1.5, 123.5],
  "Sulawesi Tengah": [-2.5, 119.5, 1.5, 123.0],
  "Sulawesi Barat": [-3.5, 118.5, -0.5, 120.0],
  "Sulawesi Selatan": [-5.8, 118.8, -0.5, 121.5],
  "Sulawesi Tenggara": [-5.0, 120.5, -2.0, 123.0],
  Maluku: [-6.5, 126.0, -2.0, 134.5],
  "Maluku Utara": [-2.5, 126.5, 3.0, 130.0],
  Papua: [-8.5, 131.0, -1.0, 141.0],
  "Papua Barat": [-4.0, 129.0, -0.5, 136.0],
};

export const INDONESIA_PROVINCES: {
  name: string;
  bounds: [number, number, number, number];
}[] = PROVINSI.map((p) => {
  const b = PROVINCE_BOUNDS[p.nama];
  const d = 0.5;
  return {
    name: p.nama,
    bounds: b ?? [p.lat - d, p.lng - d, p.lat + d, p.lng + d],
  };
});

export function randomCoordinateInBounds(
  bounds: [number, number, number, number],
): Coordinate {
  const [latMin, lonMin, latMax, lonMax] = bounds;
  const lat = latMin + Math.random() * (latMax - latMin);
  const lon = lonMin + Math.random() * (lonMax - lonMin);
  const point = { lat: round(lat, 6), lon: round(lon, 6) };
  console.log(
    `[sampler] randomCoordinateInBounds -> ${point.lat}, ${point.lon}`,
  );
  return point;
}

export function gridSampleInBounds(
  bounds: [number, number, number, number],
  gridSize: number,
): Coordinate[] {
  const [latMin, lonMin, latMax, lonMax] = bounds;
  const coords: Coordinate[] = [];
  const latStep = (latMax - latMin) / gridSize;
  const lonStep = (lonMax - lonMin) / gridSize;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      coords.push({
        lat: round(latMin + latStep * (i + 0.5), 6),
        lon: round(lonMin + lonStep * (j + 0.5), 6),
      });
    }
  }
  console.log(
    `[sampler] gridSampleInBounds: gridSize=${gridSize} -> ${coords.length} point(s)`,
  );
  return coords;
}

export function generateRandomSamples(count: number): Coordinate[] {
  // Random sampling across all Indonesia
  console.log(`[sampler] generateRandomSamples: requesting ${count} sample(s)`);
  const samples: Coordinate[] = [];
  for (let i = 0; i < count; i++) {
    const province =
      INDONESIA_PROVINCES[
        Math.floor(Math.random() * INDONESIA_PROVINCES.length)
      ];
    samples.push(randomCoordinateInBounds(province.bounds));
  }
  console.log(
    `[sampler] generateRandomSamples: generated ${samples.length} sample(s)`,
  );
  return samples;
}

export function generateGridSamples(
  provinceName: string,
  gridSize: number,
): Coordinate[] {
  const province = INDONESIA_PROVINCES.find((p) => p.name === provinceName);
  if (!province) {
    console.warn(
      `[sampler] generateGridSamples: province "${provinceName}" not found`,
    );
    return [];
  }
  console.log(
    `[sampler] generateGridSamples: province=${provinceName}, gridSize=${gridSize}`,
  );
  return gridSampleInBounds(province.bounds, gridSize);
}

function round(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}
