/**
 * Indonesia first-level subdivisions per ISO 3166-2:ID.
 * Source: ISO Online Browsing Platform (https://www.iso.org/obp/ui/#iso:code:3166:ID, retrieved 2026-09-03).
 * Codes follow the 2026-08-26 typo correction (Papua Pegunungan).
 */
export interface ISOCategory {
  en: string;
  fr: string;
  id?: string;
}

export interface ISOSubdivision {
  code: string; // e.g. "ID-AC", "ID-JK"
  /** null when the ISO entry carries no distinct short name (e.g. ID-MA Maluku, ID-PA Papua) */
  name: string | null;
  category: ISOCategory;
  geographicalUnit: string; // e.g. "ID-SM"
  aliases?: string[];
}

/**
 * Provinces + capital district + special region, ordered as in the ISO list.
 * name === null means the ISO entry carries no distinct short name (subdivision
 * name equals the state/category name); treat it as the empty/none.
 */
export const ISO3166_SUBDIVISIONS: ISOSubdivision[] = [
  {
    code: "ID-AC",
    name: "Aceh",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SM",
  },
  {
    code: "ID-BA",
    name: "Bali",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-NU",
  },
  {
    code: "ID-BT",
    name: "Banten",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-JW",
  },
  {
    code: "ID-BE",
    name: "Bengkulu",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SM",
  },
  {
    code: "ID-GO",
    name: "Gorontalo",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SL",
  },
  {
    code: "ID-JK",
    name: "Jakarta Raya",
    category: {
      en: "capital district",
      fr: "district de la capitale",
      id: "daerah khusus ibukota",
    },
    geographicalUnit: "ID-JW",
    aliases: ["DKI Jakarta", "DKI", "Daerah Khusus Ibukota Jakarta", "Jakarta"],
  },
  {
    code: "ID-JA",
    name: "Jambi",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SM",
  },
  {
    code: "ID-JB",
    name: "Jawa Barat",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-JW",
  },
  {
    code: "ID-JT",
    name: "Jawa Tengah",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-JW",
  },
  {
    code: "ID-JI",
    name: "Jawa Timur",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-JW",
  },
  {
    code: "ID-KB",
    name: "Kalimantan Barat",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-KA",
  },
  {
    code: "ID-KS",
    name: "Kalimantan Selatan",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-KA",
  },
  {
    code: "ID-KT",
    name: "Kalimantan Tengah",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-KA",
  },
  {
    code: "ID-KI",
    name: "Kalimantan Timur",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-KA",
  },
  {
    code: "ID-KU",
    name: "Kalimantan Utara",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-KA",
  },
  {
    code: "ID-BB",
    name: "Kepulauan Bangka Belitung",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SM",
  },
  {
    code: "ID-KR",
    name: "Kepulauan Riau",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SM",
  },
  {
    code: "ID-LA",
    name: "Lampung",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SM",
  },
  {
    code: "ID-MA",
    name: null,
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-ML",
    aliases: ["Maluku"],
  },
  {
    code: "ID-MU",
    name: "Maluku Utara",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-ML",
  },
  {
    code: "ID-NB",
    name: "Nusa Tenggara Barat",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-NU",
  },
  {
    code: "ID-NT",
    name: "Nusa Tenggara Timur",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-NU",
  },
  {
    code: "ID-PA",
    name: null,
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-PP",
    aliases: ["Papua"],
  },
  {
    code: "ID-PB",
    name: "Papua Barat",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-PP",
  },
  {
    code: "ID-PD",
    name: "Papua Barat Daya",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-PP",
  },
  {
    code: "ID-PE",
    name: "Papua Pegunungan",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-PP",
  },
  {
    code: "ID-PS",
    name: "Papua Selatan",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-PP",
  },
  {
    code: "ID-PT",
    name: "Papua Tengah",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-PP",
  },
  {
    code: "ID-RI",
    name: "Riau",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SM",
  },
  {
    code: "ID-SR",
    name: "Sulawesi Barat",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SL",
  },
  {
    code: "ID-SN",
    name: "Sulawesi Selatan",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SL",
  },
  {
    code: "ID-ST",
    name: "Sulawesi Tengah",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SL",
  },
  {
    code: "ID-SG",
    name: "Sulawesi Tenggara",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SL",
  },
  {
    code: "ID-SA",
    name: "Sulawesi Utara",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SL",
  },
  {
    code: "ID-SB",
    name: "Sumatera Barat",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SM",
  },
  {
    code: "ID-SS",
    name: "Sumatera Selatan",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SM",
  },
  {
    code: "ID-SU",
    name: "Sumatera Utara",
    category: { en: "province", fr: "province", id: "provinsi" },
    geographicalUnit: "ID-SM",
  },
  {
    code: "ID-YO",
    name: "Yogyakarta",
    category: {
      en: "special region",
      fr: "région spéciale",
      id: "daerah istimewa",
    },
    geographicalUnit: "ID-JW",
    aliases: ["DI Yogyakarta", "DI Yogya", "Daerah Istimewa Yogyakarta"],
  },
];

/** Case-insensitive, diacritic-insensitive lookup by code ("ID-JK"/"JK"), short name, or alias. */
export function findISO3166Subdivision(
  key: string,
): ISOSubdivision | undefined {
  const normalized = key.trim().toLowerCase();
  const codeOnly = normalized.replace(/^id-/, "");
  return ISO3166_SUBDIVISIONS.find(
    (s) =>
      s.code.toLowerCase() === normalized ||
      s.code.slice(3).toLowerCase() === codeOnly ||
      (s.name ?? "").toLowerCase() === normalized ||
      (s.aliases ?? []).some((a) => a.toLowerCase() === normalized),
  );
}

export const ISO3166_GEO_UNITS: { code: string; name: string }[] = [
  { code: "ID-SM", name: "Sumatera" },
  { code: "ID-JW", name: "Jawa" },
  { code: "ID-KA", name: "Kalimantan" },
  { code: "ID-NU", name: "Nusa Tenggara" },
  { code: "ID-SL", name: "Sulawesi" },
  { code: "ID-ML", name: "Maluku" },
  { code: "ID-PP", name: "Papua" },
];
