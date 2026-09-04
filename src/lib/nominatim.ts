import { Coordinate, NominatimAddress } from "@/types";
import { ISO3166_SUBDIVISIONS } from "@/types/iso3166";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
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

export async function reverseGeocode(
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
