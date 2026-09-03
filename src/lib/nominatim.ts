import { Coordinate, NominatimAddress } from "@/types";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const USER_AGENT = "RndGeocodingValidation/1.0 (Berijalan Address Cleansing)";

export async function reverseGeocode(coord: Coordinate): Promise<NominatimAddress> {
  const url = `${NOMINATIM_BASE_URL}/reverse?format=jsonv2&lat=${coord.lat}&lon=${coord.lon}&addressdetails=1`;

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Nominatim API error: ${response.status}`);
  }

  const data = await response.json();
  const addr = data.address || {};

  return {
    road: addr.road,
    village: addr.village || addr.suburb,
    subdistrict: addr.subdistrict,
    district: addr.district || addr.county,
    city: addr.city || addr.town,
    state: addr.state,
    postcode: addr.postcode,
    country: addr.country,
    displayName: data.display_name || "",
    confidence: data.confidence,
  };
}

export async function batchReverseGeocode(
  coords: Coordinate[]
): Promise<NominatimAddress[]> {
  const results: NominatimAddress[] = [];
  for (const coord of coords) {
    const result = await reverseGeocode(coord);
    results.push(result);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return results;
}
