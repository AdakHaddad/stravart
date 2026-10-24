const PHOTON_SEARCH_URL = "https://photon.komoot.io/api/";
const PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse";
const PELIAS_BASE_URL = "https://api.heigit.org/pelias/v1";
const MAX_RESULTS = 6;
const USER_AGENT = "RouteBuddy/0.1 (+https://routebuddy.vercel.app)";
const CACHE_HEADERS = { "Cache-Control": "private, max-age=300" };

type Coordinate = [number, number];
type Place = { center: Coordinate; location: string };
type PhotonFeature = { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };
type PeliasFeature = { geometry?: { coordinates?: unknown }; properties?: { label?: unknown } };

function validCenter(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function placeLabel(name: unknown, city: unknown, state: unknown, country: unknown, fallback: string) {
  const parts = [name, city || state, country].filter((part): part is string => typeof part === "string" && part.trim().length > 0);
  return [...new Set(parts.map((part) => part.trim()))].join(", ") || fallback;
}

function photonLabel(properties: Record<string, unknown>, fallback: string) {
  const hasName = typeof properties.name === "string" && properties.name.trim().length > 0;
  const street = [properties.housenumber, properties.street]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ");
  const area = [properties.district, properties.locality].find(
    (part): part is string => typeof part === "string" && part.trim().length > 0
  );
  return placeLabel(hasName ? properties.name : street || area, properties.city, properties.state, properties.country, fallback);
}

function placeFromPhoton(feature: PhotonFeature | undefined, fallback: string): Place | null {
  if (!validCenter(feature?.geometry?.coordinates)) return null;
  return {
    center: feature.geometry.coordinates,
    location: photonLabel(feature.properties ?? {}, fallback),
  };
}

function uniquePlaces(places: Place[]) {
  const seen = new Set<string>();
  return places.filter((place) => {
    const key = `${place.location}|${place.center[0].toFixed(4)}|${place.center[1].toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchPhoton(query: string, limit: number): Promise<Place[]> {
  const upstream = await fetch(`${PHOTON_SEARCH_URL}?q=${encodeURIComponent(query)}&limit=${limit}&lang=en`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!upstream.ok) throw new Error("photon");
  const features = (await upstream.json()).features as PhotonFeature[] | undefined;
  return uniquePlaces(
    (features ?? []).flatMap((feature) => {
      const place = placeFromPhoton(feature, query);
      return place ? [place] : [];
    })
  );
}

async function reversePhoton(center: Coordinate): Promise<Place | null> {
  const upstream = await fetch(`${PHOTON_REVERSE_URL}?lat=${center[1]}&lon=${center[0]}&limit=1&lang=en`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(6_000),
  });
  if (!upstream.ok) throw new Error("photon");
  const feature = (await upstream.json()).features?.[0] as PhotonFeature | undefined;
  return placeFromPhoton(feature, `${center[1].toFixed(4)}, ${center[0].toFixed(4)}`);
}

async function searchPelias(query: string, apiKey: string, limit: number): Promise<Place[]> {
  const upstream = await fetch(`${PELIAS_BASE_URL}/search?text=${encodeURIComponent(query)}&size=${limit}`, {
    headers: { Authorization: apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!upstream.ok) throw new Error("pelias");
  const features = (await upstream.json()).features as PeliasFeature[] | undefined;
  return uniquePlaces(
    (features ?? []).flatMap((feature) => {
      if (!validCenter(feature?.geometry?.coordinates)) return [];
      const label = typeof feature.properties?.label === "string" ? feature.properties.label : query;
      return [{ center: feature.geometry.coordinates, location: label }];
    })
  );
}

async function reversePelias(center: Coordinate, apiKey: string): Promise<Place | null> {
  const upstream = await fetch(`${PELIAS_BASE_URL}/reverse?point.lat=${center[1]}&point.lon=${center[0]}&size=1`, {
    headers: { Authorization: apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!upstream.ok) throw new Error("pelias");
  const feature = (await upstream.json()).features?.[0] as PeliasFeature | undefined;
  if (!validCenter(feature?.geometry?.coordinates)) return null;
  const label = typeof feature.properties?.label === "string" ? feature.properties.label : `${center[1].toFixed(4)}, ${center[0].toFixed(4)}`;
  return { center: feature.geometry.coordinates, location: label };
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CACHE_HEADERS });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latParam = params.get("lat");
  const lonParam = params.get("lon");

  if (latParam !== null || lonParam !== null) {
    const lat = Number(latParam);
    const lon = Number(lonParam);
    if (latParam === null || lonParam === null || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return json({ error: "Enter a valid map point." }, 400);
    }
    const center: Coordinate = [lon, lat];
    try {
      const place = await reversePhoton(center);
      if (place) return json({ results: [place] });
    } catch {
      // Fall through to Pelias when Photon is unreachable.
    }
    const apiKey = process.env.ORS_API_KEY;
    if (apiKey) {
      try {
        const place = await reversePelias(center, apiKey);
        if (place) return json({ results: [place] });
      } catch {
        // Return the coordinates below when both lookups fail.
      }
    }
    return json({ results: [{ center, location: `${lat.toFixed(4)}, ${lon.toFixed(4)}` }] });
  }

  const query = params.get("q")?.trim();
  if (!query || query.length > 160) return json({ error: "Enter a valid location." }, 400);
  const limit = Math.min(MAX_RESULTS, Math.max(1, Number(params.get("limit")) || 1));

  let photonFailed = false;
  try {
    const results = await searchPhoton(query, limit);
    if (results.length) return json({ results });
  } catch {
    photonFailed = true;
  }

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    return json({ error: photonFailed ? "Location search is unavailable." : "Location not found." }, photonFailed ? 503 : 404);
  }

  try {
    const results = await searchPelias(query, apiKey, limit);
    if (results.length) return json({ results });
  } catch {
    return json({ error: "Location search is unavailable." }, 502);
  }
  return json({ error: "Location not found." }, 404);
}
