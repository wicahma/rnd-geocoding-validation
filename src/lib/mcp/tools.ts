import { Coordinate, ExpectedAddress } from "@/types";
import { lookupGISBoundary, validateAgainstGIS } from "@/lib/gis/validator";
import { validateRoadLevel } from "@/lib/road/validator";
import { reverseGeocode } from "@/lib/nominatim";
import { executeEnhancedPipeline } from "@/lib/engine/decision";

/**
 * GeoMaps MCP Tool Handlers
 * Exposes core geospatial capabilities without duplicating business logic.
 */
export const GeoMapsMCPTools = {
  /**
   * validate_coordinate: Validate lat/lon against Nominatim, GIS boundary, and road matching.
   */
  async validateCoordinate(params: {
    latitude: number;
    longitude: number;
    expected?: ExpectedAddress;
  }) {
    const coordinate: Coordinate = { lat: params.latitude, lon: params.longitude };
    const nominatimRes = await reverseGeocode(coordinate);
    const result = await executeEnhancedPipeline(
      coordinate,
      nominatimRes,
      params.expected,
      { enableGIS: true, enableRoad: true, enableAIArbitration: true }
    );
    return result;
  },

  /**
   * get_boundary_by_coordinate: Point-in-polygon lookup for administrative hierarchy.
   */
  async getBoundaryByCoordinate(params: { latitude: number; longitude: number }) {
    const boundary = lookupGISBoundary({ lat: params.latitude, lon: params.longitude });
    return boundary || { found: false, message: "Outside covered GIS boundaries." };
  },

  /**
   * get_nearest_road: Check coordinate association with street/road name.
   */
  async getNearestRoad(params: {
    latitude: number;
    longitude: number;
    roadName?: string;
  }) {
    const coordinate: Coordinate = { lat: params.latitude, lon: params.longitude };
    return validateRoadLevel(coordinate, params.roadName, params.roadName);
  },
};
