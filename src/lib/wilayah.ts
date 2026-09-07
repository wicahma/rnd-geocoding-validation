import provinsiData from "@/data/wilayah/provinsi.json";
import kabupatenData from "@/data/wilayah/kabupaten.json";
import kecamatanData from "@/data/wilayah/kecamatan.json";

export interface Kecamatan {
  name: string;
  lat: number;
  lon: number;
}

export interface WilayahRow {
  kode: string;
  nama: string;
  lat: number;
  lng: number;
}

export const PROVINSI: WilayahRow[] = provinsiData;
export const KABUPATEN: WilayahRow[] = kabupatenData;
export const KECAMATAN: WilayahRow[] = kecamatanData;

const plainKabupaten = (nama: string) => nama.replace(/^(Kabupaten|Kota) /, "");

export const KABUPATEN_BY_PROVINSI: Record<string, WilayahRow[]> =
  Object.fromEntries(
    PROVINSI.map((prov) => [
      prov.kode,
      KABUPATEN.filter((k) => k.kode.startsWith(`${prov.kode}.`)),
    ]),
  );

export const KECAMATAN_BY_KABUPATEN: Record<string, Kecamatan[]> =
  Object.fromEntries(
    KABUPATEN.map((kab) => [
      kab.kode,
      KECAMATAN.filter((k) => k.kode.startsWith(`${kab.kode}.`)).map((k) => ({
        name: k.nama,
        lat: k.lat,
        lon: k.lng,
      })),
    ]),
  );

const DIY_KODE = "34";
export const KECAMATAN_DIY: Record<string, Kecamatan[]> = Object.fromEntries(
  KABUPATEN.filter((k) => k.kode.startsWith(`${DIY_KODE}.`)).map((kab) => [
    plainKabupaten(kab.nama),
    KECAMATAN_BY_KABUPATEN[kab.kode],
  ]),
);

export const DIY_KABUPATEN = Object.keys(KECAMATAN_DIY);
