const ORS_BASE_URL = "https://api.heigit.org/openrouteservice";
type Coordinate = [number, number];

function validCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

export async function POST(request: Request) {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return Response.json({ error: "Routing service is not configured." }, { status: 503 });
  let body: { coordinates?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid route request." }, { status: 400 }); }
  const coordinates = body.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2 || coordinates.length > 25 || !coordinates.every(validCoordinate)) return Response.json({ error: "Route needs between 2 and 25 valid waypoints." }, { status: 400 });

  const upstream = await fetch(`${ORS_BASE_URL}/v2/directions/foot-walking/geojson`, {
    method: "POST", headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates, instructions: false }), signal: AbortSignal.timeout(15_000),
  });
  if (!upstream.ok) return Response.json({ error: "Walkable route is unavailable." }, { status: 502 });
  const feature = (await upstream.json()).features?.[0];
  if (!Array.isArray(feature?.geometry?.coordinates)) return Response.json({ error: "No walkable route found." }, { status: 422 });
  return Response.json({ coordinates: feature.geometry.coordinates }, { headers: { "Cache-Control": "no-store" } });
}
