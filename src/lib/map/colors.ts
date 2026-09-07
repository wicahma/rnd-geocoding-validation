"use client";

/** Deterministic color per admin code (hue derived from code hash). */
export const colorForCode = (code: string, layer: string) => {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  const hue =
    layer === "province"
      ? h % 360
      : layer === "city"
        ? (h % 180) + 120
        : (h % 90) + 240;
  return `hsl(${hue}, 65%, 45%)`;
};

export const layerProps: Record<
  string,
  { fillOpacity: number; weight: number; color: string }
> = {
  province: { fillOpacity: 0.08, weight: 1.8, color: "#f472b6" },
  city: { fillOpacity: 0.15, weight: 1.0, color: "#60a5fa" },
  district: { fillOpacity: 0.3, weight: 0.5, color: "#34d399" },
};
