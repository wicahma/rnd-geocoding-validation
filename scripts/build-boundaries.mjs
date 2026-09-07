/**
 * Build boundary GeoJSON from cahya dsn wilayah_boundaries SQL.
 *
 * Source: https://github.com/cahyadsn/wilayah_boundaries (MIT)
 * Data: db/prov/*.sql, db/kab/*.sql, db/kec/*.sql
 * Each INSERT has path = multipolygon JSON string: [[[[lat,lng],...],...],...]
 *
 * Output: src/data/boundaries/{provinsi,kabupaten,kecamatan}.json
 * Compact FeatureCollection; coords rounded to 5 decimals (~1m at equator),
 * stored as [lon, lat] (GeoJSON standard) — same as pointInPolygon().
 * (.json extension so Next/Turbopack resolves it as a JSON module.)
 *
 * Usage: node scripts/build-boundaries.mjs
 */

import { writeFile, mkdir } from "node:fs/promises";

const BASE =
  "https://raw.githubusercontent.com/cahyadsn/wilayah_boundaries/main/db";
const OUT_DIR = "src/data/boundaries";

/** @returns {Promise<Array<{kode:string,nama:string,lat:number,lng:number,path:number[][][][]}>>} */
async function fetchSql(path) {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  const sql = await res.text();

  const rows = [];
  const insertRe =
    /INSERT INTO wilayah_boundaries\(kode,nama,lat,lng,path\) VALUES\s*([\s\S]*?);/g;
  let m;
  while ((m = insertRe.exec(sql))) {
    // Split on row boundaries: "),('kode','nama',lat,lng,'path')"
    const body = m[1];
    const rowRe =
      /\(\s*'([^']+)',\s*'((?:[^']|'')*)',\s*(-?[\d.]+),\s*(-?[\d.]+),\s*'((?:[^']|'')*)'\s*\)/g;
    let r;
    while ((r = rowRe.exec(body))) {
      rows.push({
        kode: r[1],
        nama: r[2].replace(/''/g, "'"),
        lat: parseFloat(r[3]),
        lng: parseFloat(r[4]),
        path: JSON.parse(r[5].replace(/''/g, "'")),
      });
    }
  }
  if (rows.length === 0) throw new Error(`No rows parsed from ${path}`);
  return rows;
}

/** path (depth 4: [[[[lat,lng],...]...]] ; depth 3: [[[lat,lng],...]]) -> GeoJSON MultiPolygon [[[lon,lat],...],...] */
function toGeoJSONPath(path) {
  const polygons = Array.isArray(path[0]?.[0]?.[0]) ? path : [path];
  return polygons.map((poly) =>
    poly.map((ring) => ring.map(([lat, lng]) => [round(lng), round(lat)])),
  );
}

function round(n) {
  return Math.round(n * 1e5) / 1e5;
}

function feature(row) {
  return {
    type: "Feature",
    properties: { kode: row.kode, nama: row.nama },
    geometry: {
      type: "MultiPolygon",
      coordinates: toGeoJSONPath(row.path),
    },
  };
}

async function main() {
  const provFiles = Array.from(
    { length: 8 },
    (_, i) => `prov/wilayah_boundaries_prov_${i + 1}.sql`,
  );
  const provs = (await Promise.all(provFiles.map(fetchSql))).flat();
  console.log(`provinsi: ${provs.length} rows`);

  const provCodes = provs.map((p) => p.kode);
  const kabFiles = provCodes.map((k) => `kab/wilayah_boundaries_kab_${k}.sql`);
  const kabs = (await Promise.all(kabFiles.map(fetchSql))).flat();
  console.log(`kabupaten: ${kabs.length} rows`);

  const kabCodes = kabs.map((k) => k.kode);
  const kecFiles = kabCodes.map(
    (k) => `kec/wilayah_boundaries_kec_${k.split(".")[0]}.sql`,
  );
  const uniqueKecFiles = [...new Set(kecFiles)];
  const kecs = (await Promise.all(uniqueKecFiles.map(fetchSql))).flat();
  console.log(`kecamatan: ${kecs.length} rows`);

  await mkdir(OUT_DIR, { recursive: true });
  const datasets = [
    ["provinsi", provs],
    ["kabupaten", kabs],
    ["kecamatan", kecs],
  ];

  for (const [name, rows] of datasets) {
    const fc = {
      type: "FeatureCollection",
      name,
      generatedAt: new Date().toISOString(),
      source: "cahyadsn/wilayah_boundaries (MIT)",
      datasetVersion: "2026.1",
      features: rows.map(feature),
    };
    const out = `${OUT_DIR}/${name}.json`;
    await writeFile(out, JSON.stringify(fc));
    const sizeMB = (Buffer.byteLength(JSON.stringify(fc)) / 1048576).toFixed(2);
    console.log(`wrote ${out} (${sizeMB} MB)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
