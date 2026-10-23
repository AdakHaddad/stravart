const PHOTON_BASE_URL = "https://photon.komoot.io/api/";
const PELIAS_BASE_URL = "https://api.heigit.org/pelias/v1";
type Coordinate = [number, number];

function validCenter(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function placeLabel(name: unknown, city: unknown, state: unknown, country: unknown, fallback: string) {
  const parts = [name, city || state, country].filter((part): part is string => typeof part === "string" && part.trim().length > 0);
  return [...new Set(parts.map((part) => part.trim()))].join(", ") || fallback;
}

async function searchPhoton(query: string) {
  const upstream = await fetch(`${PHOTON_BASE_URL}?q=${encodeURIComponent(query)}&limit=1&lang=en`, {
    headers: { "User-Agent": "RouteBuddy/0.1 (+https://routebuddy.vercel.app)", Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!upstream.ok) return null;
  const feature = (await upstream.json()).features?.[0];
  if (!validCenter(feature?.geometry?.coordinates)) return null;
  const properties = feature.properties ?? {};
  return {
    center: feature.geometry.coordinates as Coordinate,
    location: placeLabel(properties.name, properties.city, properties.state, properties.country, query),
  };
}

async function searchPelias(query: string, apiKey: string) {
  const upstream = await fetch(`${PELIAS_BASE_URL}/search?text=${encodeURIComponent(query)}&size=3`, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!upstream.ok) return null;
  const feature = (await upstream.json()).features?.[0];
  if (!validCenter(feature?.geometry?.coordinates)) return null;
  return {
    center: feature.geometry.coordinates as Coordinate,
    location: feature.properties?.label || query,
  };
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length > 160) return Response.json({ error: "Enter a valid location." }, { status: 400 });

  try {
    const place = await searchPhoton(query);
    if (place) return Response.json(place, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    // Fall through to Pelias when Photon is unreachable.
  }

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return Response.json({ error: "Routing service is not configured." }, { status: 503 });

  try {
    const place = await searchPelias(query, apiKey);
    if (place) return Response.json(place, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return Response.json({ error: "Location search is unavailable." }, { status: 502 });
  }
  return Response.json({ error: "Location not found." }, { status: 404 });
}
