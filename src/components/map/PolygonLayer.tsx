"use client";

import { memo } from "react";
import { Polygon, Tooltip } from "react-leaflet";
import { colorForCode, layerProps } from "@/lib/map/colors";
import { BoundaryFeature, LayerKey } from "@/lib/map/data";

interface Props {
  layer: LayerKey;
  features: BoundaryFeature[];
  highlighted?: string; // admin code (province "11", city "11.01", district "11.01.01")
}

/** Memoized Leaflet polygons for an optional-boundary layer. */
const PolygonLayer = memo(function PolygonLayer({
  layer,
  features,
  highlighted,
}: Props) {
  const p = layerProps[layer];
  return (
    <>
      {features.map((f) => {
        const hl = highlighted === f.kode;
        return (
          <Polygon
            key={`${layer}-${f.kode}`}
            positions={f.polygons.map((poly) =>
              poly.map((ring) =>
                ring.map(
                  ([lon, lat]) => [lat, lon] as unknown as [number, number],
                ),
              ),
            )}
            pathOptions={{
              color: p.color,
              weight: hl ? p.weight + 2 : p.weight,
              fillColor: colorForCode(f.kode, layer),
              fillOpacity: hl
                ? Math.min(p.fillOpacity + 0.25, 0.85)
                : p.fillOpacity,
            }}
          >
            <Tooltip sticky>
              <span className="font-semibold">
                {f.nama} <span className="text-neutral-500">({f.kode})</span>
              </span>
            </Tooltip>
          </Polygon>
        );
      })}
    </>
  );
});

export default PolygonLayer;
