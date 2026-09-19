const GEOCODE_BASE_URL = "https://api.heigit.org/pelias/v1";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return Response.json({ error: "Routing service is not configured." }, { status: 503 });
  if (!query || query.length > 160) return Response.json({ error: "Enter a valid location." }, { status: 400 });

  const upstream = await fetch(`${GEOCODE_BASE_URL}/search?text=${encodeURIComponent(query)}&size=1`, {
    headers: { Authorization: apiKey }, signal: AbortSignal.timeout(10_000),
  });
  if (!upstream.ok) return Response.json({ error: "Location search is unavailable." }, { status: 502 });

  const feature = (await upstream.json()).features?.[0];
  if (!Array.isArray(feature?.geometry?.coordinates) || feature.geometry.coordinates.length !== 2) return Response.json({ error: "Location not found." }, { status: 404 });
  return Response.json({ center: feature.geometry.coordinates, location: feature.properties?.label || query }, { headers: { "Cache-Control": "private, max-age=300" } });
}
