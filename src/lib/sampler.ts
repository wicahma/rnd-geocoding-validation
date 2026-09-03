import { Coordinate } from "@/types";

// Rough bounding boxes for major Indonesian provinces (lat/lon min/max)
export const INDONESIA_PROVINCES: { name: string; bounds: [number, number, number, number] }[] = [
  { name: "Aceh", bounds: [2.0, 95.5, 5.5, 98.0] },
  { name: "Sumatera Utara", bounds: [0.5, 97.5, 3.5, 100.5] },
  { name: "Sumatera Barat", bounds: [-2.5, 98.0, 0.5, 101.5] },
  { name: "Riau", bounds: [-1.0, 100.5, 2.0, 104.0] },
  { name: "Kepulauan Riau", bounds: [-1.0, 103.5, 2.0, 106.5] },
  { name: "Jambi", bounds: [-2.5, 101.5, -0.5, 104.5] },
  { name: "Sumatera Selatan", bounds: [-4.5, 102.5, -1.0, 106.0] },
  { name: "Bangka Belitung", bounds: [-3.5, 105.0, -1.0, 108.0] },
  { name: "Bengkulu", bounds: [-5.0, 101.0, -2.0, 103.5] },
  { name: "Lampung", bounds: [-5.5, 103.5, -3.0, 106.0] },
  { name: "DKI Jakarta", bounds: [-6.4, 106.7, -6.0, 107.0] },
  { name: "Jawa Barat", bounds: [-7.5, 105.5, -5.5, 108.8] },
  { name: "Banten", bounds: [-7.0, 105.0, -5.0, 106.8] },
  { name: "Jawa Tengah", bounds: [-8.0, 108.5, -6.0, 111.5] },
  { name: "DI Yogyakarta", bounds: [-8.2, 110.0, -7.5, 110.8] },
  { name: "Jawa Timur", bounds: [-8.8, 111.0, -6.5, 114.8] },
  { name: "Bali", bounds: [-8.8, 114.4, -8.0, 115.7] },
  { name: "Nusa Tenggara Barat", bounds: [-9.2, 115.8, -8.0, 119.0] },
  { name: "Nusa Tenggara Timur", bounds: [-11.0, 118.5, -8.0, 125.0] },
  { name: "Kalimantan Barat", bounds: [-2.5, 108.5, 2.0, 114.5] },
  { name: "Kalimantan Tengah", bounds: [-3.5, 110.5, -0.5, 115.0] },
  { name: "Kalimantan Selatan", bounds: [-4.5, 114.5, -2.0, 116.5] },
  { name: "Kalimantan Timur", bounds: [-2.5, 115.0, 2.5, 119.0] },
  { name: "Kalimantan Utara", bounds: [1.5, 116.0, 4.5, 118.0] },
  { name: "Sulawesi Utara", bounds: [0.5, 123.5, 4.5, 126.5] },
  { name: "Gorontalo", bounds: [0.3, 121.5, 1.5, 123.5] },
  { name: "Sulawesi Tengah", bounds: [-2.5, 119.5, 1.5, 123.0] },
  { name: "Sulawesi Barat", bounds: [-3.5, 118.5, -0.5, 120.0] },
  { name: "Sulawesi Selatan", bounds: [-5.8, 118.8, -0.5, 121.5] },
  { name: "Sulawesi Tenggara", bounds: [-5.0, 120.5, -2.0, 123.0] },
  { name: "Maluku", bounds: [-6.5, 126.0, -2.0, 134.5] },
  { name: "Maluku Utara", bounds: [-2.5, 126.5, 3.0, 130.0] },
  { name: "Papua", bounds: [-8.5, 131.0, -1.0, 141.0] },
  { name: "Papua Barat", bounds: [-4.0, 129.0, -0.5, 136.0] },
  { name: "Papua Tengah", bounds: [-6.5, 135.5, -2.0, 139.5] },
  { name: "Papua Pegunungan", bounds: [-6.0, 137.0, -2.5, 141.0] },
  { name: "Papua Selatan", bounds: [-8.5, 134.5, -4.0, 141.0] },
];

export function randomCoordinateInBounds(bounds: [number, number, number, number]): Coordinate {
  const [latMin, lonMin, latMax, lonMax] = bounds;
  const lat = latMin + Math.random() * (latMax - latMin);
  const lon = lonMin + Math.random() * (lonMax - lonMin);
  return { lat: round(lat, 6), lon: round(lon, 6) };
}

export function gridSampleInBounds(
  bounds: [number, number, number, number],
  gridSize: number
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
  return coords;
}

export function generateRandomSamples(count: number): Coordinate[] {
  // Random sampling across all Indonesia
  const samples: Coordinate[] = [];
  for (let i = 0; i < count; i++) {
    const province = INDONESIA_PROVINCES[Math.floor(Math.random() * INDONESIA_PROVINCES.length)];
    samples.push(randomCoordinateInBounds(province.bounds));
  }
  return samples;
}

export function generateGridSamples(provinceName: string, gridSize: number): Coordinate[] {
  const province = INDONESIA_PROVINCES.find((p) => p.name === provinceName);
  if (!province) return [];
  return gridSampleInBounds(province.bounds, gridSize);
}

function round(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}