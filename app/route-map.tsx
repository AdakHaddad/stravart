"use client";

import mapboxgl, { Map as MapboxMap, type GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";

type Point = [number, number];

function routeFeature(points: Point[]) {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: points },
  } as const;
}

const emptyRoute = { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection;

function routeData(points: Point[]) {
  return points.length > 1 ? routeFeature(points) : emptyRoute;
}

function fitRoute(instance: MapboxMap, points: Point[], duration: number) {
  if (points.length < 2) return;
  const bounds = points.reduce(
    (box, point) => box.extend(point),
    new mapboxgl.LngLatBounds(points[0], points[0])
  );
  instance.fitBounds(bounds, { padding: 48, maxZoom: 15, duration });
}

export function RouteMapCanvas({ center, points, outline, onPick }: { center: Point; points: Point[]; outline?: Point[]; onPick?: (center: Point) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const loaded = useRef(false);
  const initialCenter = useRef(center);
  const latestCenter = useRef(center);
  const latestPoints = useRef(points);
  const latestOutline = useRef(outline);
  const onPickRef = useRef(onPick);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    latestCenter.current = center;
  }, [center]);

  useEffect(() => {
    latestPoints.current = points;
  }, [points]);

  useEffect(() => {
    latestOutline.current = outline;
  }, [outline]);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // Create the map exactly once. Center/route updates are applied in the
  // effects below so prop changes never destroy and recreate the map.
  useEffect(() => {
    const container = element.current;
    if (!container || map.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!token) {
      window.setTimeout(
        () => setProblem("Mapbox public token is missing. Set NEXT_PUBLIC_MAPBOX_TOKEN or MAPBOX_PUBLIC_TOKEN."),
        0
      );
      return;
    }

    mapboxgl.accessToken = token;

    let instance: MapboxMap;
    try {
      instance = new MapboxMap({
        container,
        style: "mapbox://styles/mapbox/outdoors-v12",
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

    const handlePick = (event: MouseEvent) => {
      if (!onPickRef.current || !(event.target instanceof HTMLCanvasElement)) return;
      const lngLat = instance.unproject(new mapboxgl.Point(event.offsetX, event.offsetY));
      onPickRef.current([lngLat.lng, lngLat.lat]);
    };
    container.addEventListener("click", handlePick);

    instance.on("load", () => {
      loaded.current = true;
      setProblem(null);
      // A search can finish before tiles load; apply the latest center once
      // the map exists instead of leaving the initial view in place.
      instance.jumpTo({ center: latestCenter.current });
      instance.addSource("route", {
        type: "geojson",
        data: routeData(latestPoints.current),
      });
      instance.addSource("target", {
        type: "geojson",
        data: routeData(latestOutline.current ?? []),
      });
      instance.addLayer({
        id: "target-line",
        type: "line",
        source: "target",
        paint: {
          "line-color": "#d8ff40",
          "line-width": 3,
          "line-dasharray": [2, 2],
          "line-opacity": 0.95,
        },
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
      fitRoute(instance, [...latestPoints.current, ...(latestOutline.current ?? [])], 0);
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
    observer.observe(container);
    const timer = window.setTimeout(() => instance.resize(), 300);
    return () => {
      container.removeEventListener("click", handlePick);
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
    source?.setData(routeData(points));
    const target = map.current.getSource("target") as GeoJSONSource | undefined;
    target?.setData(routeData(outline ?? []));
    fitRoute(map.current, [...points, ...(outline ?? [])], 600);
  }, [points, outline]);

  return (
    <div className={onPick ? "map-canvas pickable" : "map-canvas"} ref={element} aria-label="Interactive Mapbox route map">
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
          {problem}
        </div>
      ) : null}
    </div>
  );
}
