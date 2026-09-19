"use client";

import { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

type Point = [number, number];

export function RouteMapCanvas({ center, points }: { center: Point; points: Point[] }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!element.current || map.current) return;
    const instance = new MapLibreMap({ container: element.current, style: "https://tiles.openfreemap.org/styles/liberty", center, zoom: 12, interactive: false });
    instance.on("load", () => {
      instance.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points } } });
      instance.addLayer({ id: "route-outline", type: "line", source: "route", paint: { "line-color": "#f7f6ee", "line-width": 10 } });
      instance.addLayer({ id: "route-line", type: "line", source: "route", paint: { "line-color": "#10221f", "line-width": 6, "line-opacity": .92 } });
    });
    map.current = instance;
    return () => { instance.remove(); map.current = null; };
  }, [center, points]);

  return <div className="map-canvas" ref={element} aria-label="Interactive OpenStreetMap route map" />;
}
