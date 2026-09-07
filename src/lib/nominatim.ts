import { Coordinate, NominatimAddress } from "@/types";
import { ISO3166_SUBDIVISIONS } from "@/types/iso3166";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const NOMINATIM_BERIJALAN_BASE_URL =
  process.env.NEXT_PUBLIC_NOMINATIM_GEOSERVICE_BASEURL;
const USER_AGENT = "RndGeocodingValidation/1.0 (Berijalan Address Cleansing)";

export interface INominatimAPIRes {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  category: string;
  type: string;
  place_rank: number;
  importance: number;
  addresstype: string;
  name: string;
  display_name: string;
  address: Address;
  boundingbox: string[];
}

export interface IGeocodingAPIRes {
  reqId: string;
  status: string;
  message: string;
  error: any;
  data: DataGeocoding;
}

export interface DataGeocoding {
  address: string;
  latitude: number;
  longitude: number;
  placeName: string;
  latitudeDetail: number;
  longitudeDetail: number;
  flag: string;
  flagMessage: string;
}

export interface Address {
  road: string;
  city_block: string;
  village: string;
  suburb: string;
  city_district: string;
  city: string;
  "ISO3166-2-lvl4": string;
  postcode: string;
  country: string;
  country_code: string;
}

function matchProvince(str: string): string | null {
  const norm = str
    .toLowerCase()
    .replace(/^(provinsi|prov\.?)\s+/i, "")
    .trim();
  for (const sub of ISO3166_SUBDIVISIONS) {
    if (
      sub.name &&
      (sub.name.toLowerCase() === norm || norm.includes(sub.name.toLowerCase()))
    ) {
      return sub.name;
    }
    if (sub.aliases) {
      for (const alias of sub.aliases) {
        if (
          alias.toLowerCase() === norm ||
          norm.includes(alias.toLowerCase())
        ) {
          return sub.name || alias;
        }
      }
    }
  }
  return null;
}

export function parseAddressString(address: string): Partial<NominatimAddress> {
  // ponytail: keyword & anchor pattern parser. Upgrade to LLM when unformatted text fails.
  console.log("[address-parser] params: ", address);

  if (!address) return {};

  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return {};

  const result: Partial<NominatimAddress> = {};
  const unassigned: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Country anchor
    if (/^(indonesia)$/i.test(part)) {
      result.country = part;
      continue;
    }

    // Postcode anchor (5 digits)
    if (/^\d{5}$/.test(part)) {
      result.postcode = part;
      continue;
    }

    // Province check
    const prov = matchProvince(part);
    if (prov) {
      result.state = prov;
      continue;
    }

    // Explicit prefix checks
    if (/^(kabupaten|kab\.?|kota)\s+/i.test(part)) {
      result.city = part;
      continue;
    }

    if (/^(kecamatan|kec\.?)\s+/i.test(part)) {
      result.district = part;
      continue;
    }

    if (/^(kelurahan|kel\.?|desa)\s+/i.test(part)) {
      result.village = part;
      result.subdistrict = part;
      continue;
    }

    if (/^(jl\.?|jalan|gang|gg\.?|komplek|blok)\s+/i.test(part)) {
      result.road = result.road ? `${result.road}, ${part}` : part;
      continue;
    }

    unassigned.push(part);
  }

  // Fallback positional assignment for remaining unassigned parts (right to left)
  if (!result.state && unassigned.length > 0) result.state = unassigned.pop();
  if (!result.city && unassigned.length > 0) result.city = unassigned.pop();
  if (!result.district && unassigned.length > 0)
    result.district = unassigned.pop();
  if (!result.village && unassigned.length > 0) {
    result.village = unassigned.pop();
    result.subdistrict = result.village;
  }
  if (unassigned.length > 0) {
    const remainingRoad = unassigned.join(", ");
    result.road = result.road
      ? `${remainingRoad}, ${result.road}`
      : remainingRoad;
  }

  console.log("[address-parser] result: ", result);

  return result;
}

export async function reverseGeocode(
  coord: Coordinate,
  source: "osm" | "berijalan" = "berijalan",
): Promise<NominatimAddress> {
  if (source === "osm") {
    return reverseGeocodeOSM(coord);
  } else {
    return reverseGeocodeGeoservice(coord);
  }
}

export async function reverseGeocodeGeoservice(
  coord: Coordinate,
): Promise<NominatimAddress> {
  const url = `${NOMINATIM_BERIJALAN_BASE_URL}/gateway/map/v1/api/search/geocoding?token=${process.env.NEXT_PUBLIC_NOMINATIM_TOKEN}`;
  console.log(
    `[geocoding] reverseGeocode Berijalan request: lat=${coord.lat}, lon=${coord.lon}`,
  );

  const response = await fetch(url, {
    headers: {
      Authorization: process.env.NEXT_PUBLIC_NOMINATIM_BEARER || "",
      APIKey: "c3ee1bb0-7b2b-4929-8207-de138ac733d3",
      "X-Frame-Options": "SAMEORIGIN",
      "Strict-Transport-Security":
        "max-age=31536000; includeSubDomains; preload",
      "X-XSS-Protection": "1; mode=block",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      latitude: coord.lat,
      longitude: coord.lon,
    }),
    method: "POST",
  });

  if (!response.ok) {
    console.error(
      `[geocoding] API error ${response.status} for ${coord.lat},${coord.lon}`,
    );
    throw new Error(`Nominatim API error: ${response.status}`);
  }

  const data: IGeocodingAPIRes = await response.json();
  const rawAddress = data.data?.address || "";
  const parsed = parseAddressString(rawAddress);

  const result: NominatimAddress = {
    displayName: rawAddress,
    road: parsed.road,
    village: parsed.village,
    subdistrict: parsed.subdistrict,
    district: parsed.district,
    city: parsed.city,
    state: parsed.state || "-",
    postcode: parsed.postcode,
    country: parsed.country,
    confidence: 0,
  };
  console.log(
    `[geocoding] reverseGeocode raw data result: ${JSON.stringify(data, null, 2)}`,
  );
  console.log(
    `[geocoding] reverseGeocode details: road="${result.road || "-"}", village="${result.village || "-"}", district="${result.district || "-"}", city="${result.city || "-"}", state="${result.state || "-"}", postcode="${result.postcode || "-"}"`,
  );
  console.log(
    `[geocoding] reverseGeocode response: ${JSON.stringify(result, null, 2)}`,
  );
  console.log(
    `[geocoding] reverseGeocode done: road="${result.road || "-"}", village="${result.village || "-"}", district="${result.district || "-"}", city="${result.city || "-"}", state="${result.state || "-"}", postcode="${result.postcode || "-"}"`,
  );
  return result;
}

export async function reverseGeocodeOSM(
  coord: Coordinate,
): Promise<NominatimAddress> {
  const url = `${NOMINATIM_BASE_URL}/reverse?format=jsonv2&lat=${coord.lat}&lon=${coord.lon}&addressdetails=1`;
  console.log(
    `[nominatim] reverseGeocode request: lat=${coord.lat}, lon=${coord.lon}`,
  );

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    console.error(
      `[nominatim] API error ${response.status} for ${coord.lat},${coord.lon}`,
    );
    throw new Error(`Nominatim API error: ${response.status}`);
  }

  const data: INominatimAPIRes = await response.json();
  const addr = data.address || {};

  const result: NominatimAddress = {
    road: addr.road,
    village: addr.village,
    subdistrict: addr.suburb,
    district: addr.suburb || addr.city_district,
    city: addr.city,
    state:
      ISO3166_SUBDIVISIONS.find((s) => s.code === addr["ISO3166-2-lvl4"])
        ?.name || "-",
    postcode: addr.postcode,
    country: addr.country,
    displayName: data.display_name || "",
    confidence: 0,
  };
  console.log(
    `[nominatim] reverseGeocode raw data result: ${JSON.stringify(data, null, 2)}`,
  );
  console.log(
    `[nominatim] reverseGeocode details: road="${result.road || "-"}", village="${result.village || "-"}", district="${result.district || "-"}", city="${result.city || "-"}", state="${result.state || "-"}", postcode="${result.postcode || "-"}"`,
  );
  console.log(
    `[nominatim] reverseGeocode response: ${JSON.stringify(result, null, 2)}`,
  );
  console.log(
    `[nominatim] reverseGeocode done: road="${result.road || "-"}", village="${result.village || "-"}", district="${result.district || "-"}", city="${result.city || "-"}", state="${result.state || "-"}", postcode="${result.postcode || "-"}"`,
  );
  return result;
}

export async function batchReverseGeocode(
  coords: Coordinate[],
): Promise<NominatimAddress[]> {
  console.log(
    `[nominatim] batchReverseGeocode started for ${coords.length} coordinate(s)`,
  );
  const results: NominatimAddress[] = [];
  for (let i = 0; i < coords.length; i++) {
    const coord = coords[i];
    console.log(`[nominatim] batch item ${i + 1}/${coords.length}`);
    const result = await reverseGeocode(coord);
    results.push(result);
    if (i < coords.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  console.log(
    `[nominatim] batchReverseGeocode completed for ${coords.length} coordinate(s)`,
  );
  return results;
}
