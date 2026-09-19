"use client";

import { Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

type Point = [number, number];

function routeFeature(points: Point[]) {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: points },
  } as const;
}

export function RouteMapCanvas({ center, points }: { center: Point; points: Point[] }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const loaded = useRef(false);
  const initialCenter = useRef(center);
  const latestPoints = useRef(points);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    latestPoints.current = points;
  }, [points]);

  // Create the map exactly once. Center/route updates are applied in the
  // effects below so prop changes never destroy and recreate the map.
  useEffect(() => {
    if (!element.current || map.current) return;
    let instance: MapLibreMap;
    try {
      instance = new MapLibreMap({
        container: element.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: initialCenter.current,
        zoom: 13,
        interactive: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "WebGL is unavailable, so the map cannot render.";
      // Defer: the lint rules forbid synchronous setState in an effect body.
      window.setTimeout(() => setProblem(message), 0);
      return;
    }
    map.current = instance;

    instance.on("load", () => {
      loaded.current = true;
      setProblem(null);
      instance.addSource("route", {
        type: "geojson",
        data: routeFeature(latestPoints.current),
      });
      instance.addLayer({
        id: "route-outline",
        type: "line",
        source: "route",
        paint: { "line-color": "#f7f6ee", "line-width": 10 },
      });
      instance.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#10221f", "line-width": 6, "line-opacity": 0.92 },
      });
      instance.resize();
    });
    instance.on("error", (event) => {
      const detail = (event as { error?: { message?: string } })?.error?.message;
      setProblem(detail ? `Map tiles failed to load: ${detail}` : "Map tiles failed to load.");
    });

    // The container can measure 0x0 on first mount (fonts/grid not settled
    // yet); resizing on layout changes keeps the canvas from staying blank.
    const observer = new ResizeObserver(() => {
      if (map.current) map.current.resize();
    });
    if (element.current) observer.observe(element.current);
    const timer = window.setTimeout(() => instance.resize(), 300);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      loaded.current = false;
      instance.remove();
      map.current = null;
    };
  }, []);

  // Follow the searched center without recreating the map.
  useEffect(() => {
    if (!loaded.current || !map.current) return;
    map.current.easeTo({ center, duration: 600 });
  }, [center]);

  // Update the drawn route in place when previews or snapped routes change.
  useEffect(() => {
    if (!loaded.current || !map.current) return;
    const source = map.current.getSource("route") as GeoJSONSource | undefined;
    source?.setData(routeFeature(points));
  }, [points]);

  return (
    <div className="map-canvas" ref={element} aria-label="Interactive OpenStreetMap route map">
      {problem ? (
        <div
          style={{
            position: "absolute",
            inset: "auto 8px 8px 8px",
            background: "rgba(16,34,31,.88)",
            color: "#f2f0e9",
            fontSize: 11,
            lineHeight: 1.5,
            padding: "8px 10px",
            borderRadius: 6,
          }}
          role="alert"
        >
          {problem} Check your connection or whether tiles.openfreemap.org is blocked.
        </div>
      ) : null}
    </div>
  );
}
