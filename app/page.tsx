"use client";

import { FormEvent, useMemo, useState } from "react";
import { RouteMapCanvas } from "./route-map";

type Art = "heart" | "bolt" | "flower" | "star" | "wave";
type Point = [number, number];
const defaultCenter: Point = [106.8456, -6.2088];
const art: Record<Art, { name: string; path: string; points: Point[] }> = {
  heart: { name: "Heart loop", path: "M238 385 C92 306 78 164 155 129 C201 109 232 139 250 170 C270 135 300 108 347 128 C424 162 405 307 262 385 C254 390 246 390 238 385Z", points: [[0,.8],[-.75,.3],[-.6,-.4],[0,-.1],[.6,-.4],[.75,.3],[0,.8]] },
  bolt: { name: "Electric bolt", path: "M287 66 L131 245 H218 L189 401 L377 189 H285 Z", points: [[.25,-.85],[-.75,-.05],[-.25,-.05],[-.45,.8],[.85,-.35],[.2,-.35],[.25,-.85]] },
  flower: { name: "City bloom", path: "M250 218 C184 124 97 167 130 238 C68 259 92 351 165 337 C156 414 251 414 250 329 C298 413 382 380 352 318 C437 318 420 226 343 242 C378 164 283 128 250 218Z", points: [[0,-.55],[-.7,-.45],[-.85,.15],[-.35,.65],[0,.15],[.35,.65],[.85,.15],[.7,-.45],[0,-.55]] },
  star: { name: "Star loop", path: "M250 55 L294 190 L437 190 L321 273 L365 414 L250 329 L135 414 L179 273 L63 190 L206 190 Z", points: [[0,-.85],[.25,-.2],[.9,-.2],[.37,.2],[.55,.85],[0,.48],[-.55,.85],[-.37,.2],[-.9,-.2],[-.25,-.2],[0,-.85]] },
  wave: { name: "Wave loop", path: "M70 275 C140 125 220 125 290 275 S440 425 460 210 C390 360 310 360 235 210 S90 65 40 235", points: [[-.9,.2],[-.6,-.55],[-.2,-.55],[.15,.2],[.5,.65],[.85,-.1],[.45,.35],[.05,.35],[-.35,-.25],[-.75,-.25],[-.9,.2]] },
};
const chooseArt = (idea: string, fallback: Art): Art => {
  const text = idea.toLowerCase();
  if (text.includes("lightning") || text.includes("bolt")) return "bolt";
  if (text.includes("flower") || text.includes("bloom")) return "flower";
  if (text.includes("star")) return "star";
  if (text.includes("wave") || text.includes("ocean")) return "wave";
  return text.includes("heart") || text.includes("love") ? "heart" : fallback;
};
function waypoints(kind: Art, center: Point, distance: number): Point[] {
  const scale = .006 + distance * .00085;
  return art[kind].points.map(([x, y]) => [center[0] + x * scale / Math.cos(center[1] * Math.PI / 180), center[1] + y * scale]);
}
function Map({ kind, center, points }: { kind: Art; center: Point; points: Point[] }) {
  return <div className="map" aria-label={`${art[kind].name} route preview`}>
    <RouteMapCanvas center={center} points={points} />
    <div className="map-credit">© OpenStreetMap contributors</div>
  </div>;
}
const xmlEscapes: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" };
const xml = (value: string) => value.replace(/[<>&'\"]/g, (character) => xmlEscapes[character]);
function downloadGpx(name: string, points: Point[], distance: number, location: string) {
  const tracks = points.map(([lon, lat]) => `    <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}" />`).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="RouteBuddy" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${xml(name)}</name><desc>${distance} km near ${xml(location)}</desc></metadata><trk><name>${xml(name)}</name><trkseg>\n${tracks}\n</trkseg></trk></gpx>`;
  const url = URL.createObjectURL(new Blob([body], { type: "application/gpx+xml" })); const link = document.createElement("a"); link.href = url; link.download = `RouteBuddy-${name.replaceAll(" ", "-")}.gpx`; link.click(); URL.revokeObjectURL(url);
}

export default function Home() {
  const [idea, setIdea] = useState(""); const [kind, setKind] = useState<Art>("heart"); const [location, setLocation] = useState("Jakarta, Indonesia"); const [center, setCenter] = useState<Point>(defaultCenter); const [distance, setDistance] = useState(6); const [route, setRoute] = useState<Point[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const previews = useMemo(() => waypoints(kind, center, distance), [kind, center, distance]);
  const ready = route.length > 0;
  async function generate() {
    if (!idea.trim()) return setError("Describe the art you want to make, or choose a quick pick.");
    setBusy(true); setError(""); setMessage("");
    try {
      const lookup = await fetch(`/api/geocode?q=${encodeURIComponent(location)}`); if (!lookup.ok) throw new Error("search");
      const place = await lookup.json() as { center?: Point; location?: string }; if (!place.center) return setError("We couldn’t find that place. Try a more specific city, address, or landmark.");
      const nextCenter = place.center; const nextKind = chooseArt(idea, kind); const points = waypoints(nextKind, nextCenter, distance);
      const direction = await fetch("/api/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coordinates: points }) }); if (!direction.ok) throw new Error("directions");
      const snapped = (await direction.json()).coordinates as Point[] | undefined; if (!snapped?.length) throw new Error("empty");
      setCenter(nextCenter); setLocation(place.location || location); setKind(nextKind); setRoute(snapped); setMessage("Street-snapped route ready. Review it before you go."); document.getElementById("routes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch { setError("We couldn’t build a walkable route there. Try a denser area, a shorter distance, or another art prompt."); } finally { setBusy(false); }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void generate(); };
  return <main><header className="topbar"><a className="brand" href="#top"><span className="brand-mark">S</span><span>RouteBuddy</span></a><nav><a href="#how">How it works</a><a href="#routes">Your route</a></nav></header>
    <section className="hero" id="top"><div className="hero-copy"><p className="kicker"><span className="pulse" /> STREET-LEVEL ROUTE ART</p><h1>Search a place.<br /><em>Make your mark.</em></h1><p className="lede">Turn an art prompt into a walkable route on a real map. Search any city, address, or landmark, then inspect and export the result.</p><div className="hero-notes"><span>Live place search</span><span>Street-snapped routes</span><span>GPX export</span></div></div><div className="hero-map"><Map kind={kind} center={center} points={route.length ? route : previews} /></div></section>
    <section className="studio"><div className="studio-heading"><div><p className="section-label">01 / SEARCH & DRAW</p><h2>What do you want<br />to draw today?</h2></div><p>Choose a place, describe the art, and we’ll try to fit it to walkable streets.</p></div><form className="creator-grid" onSubmit={submit} noValidate><div className="idea-panel"><label htmlFor="idea">Art prompt</label><div className="idea-field"><input id="idea" value={idea} onChange={(e) => { setIdea(e.target.value); setError(""); }} aria-invalid={Boolean(error)} placeholder="Try “heart”, “star”, “wave”..." /><button type="submit" aria-label="Generate route" disabled={busy}>↗</button></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="quick-picks"><span>Quick picks</span>{(Object.keys(art) as Art[]).map((item) => <button type="button" className={kind === item ? "picked" : ""} onClick={() => { setKind(item); setIdea(item); }} key={item}>{art[item].name}</button>)}</div></div><div className="settings-panel"><div className="setting-title"><label htmlFor="distance">Target distance</label><strong>{distance}.0 km</strong></div><input className="distance" id="distance" type="range" min="3" max="15" value={distance} onChange={(e) => setDistance(Number(e.target.value))} /><div className="range-labels"><span>3 km</span><span>15 km</span></div><div className="location"><span className="pin">◎</span><div><label htmlFor="location">SEARCH ON THE MAP</label><input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, address, or landmark" /></div></div><button className="primary" type="submit" disabled={busy}>{busy ? "Finding streets…" : "Generate walkable route"}<span>→</span></button><p className="token-note">Routing is secured server-side; no provider key is exposed in your browser.</p></div></form></section>
    <section className="result" id="routes"><div className="result-top"><div><p className="section-label">02 / YOUR ROUTE</p><h2>{ready ? "Your route is ready." : "Ready when you are."}</h2></div><p>{ready ? `We fitted ${art[kind].name.toLowerCase()} to streets near ${location}.` : "Search a location and choose an art prompt to generate a walkable route."}</p></div>{message && <p className="action-message" role="status">{message}</p>}<div className="route-result"><div className="result-map"><Map kind={kind} center={center} points={route.length ? route : previews} /></div><div className="route-details"><span className="status"><i /> {ready ? "ROUTE READY" : "WAITING FOR YOUR SEARCH"}</span><h3>{art[kind].name}</h3><div className="metrics"><div><strong>{distance}.0 <small>km</small></strong><span>Target</span></div><div><strong>{ready ? route.length : "--"}<small> pts</small></strong><span>Street points</span></div><div><strong>{ready ? "yes" : "--"}</strong><span>Walkable</span></div></div><div className="route-tip"><b>◌</b><p><strong>Always review before heading out</strong><br />Routes use public street data and can change. GPX is a route suggestion, not turn-by-turn navigation.</p></div><button className="download" disabled={!ready} onClick={() => { downloadGpx(art[kind].name, route, distance, location); setMessage("GPX downloaded. Review it in your navigation app before starting."); }}>Download GPX <span>↓</span></button></div></div></section>
    <section className="steps" id="how"><p className="section-label">HOW IT WORKS</p><div><h2>Less planning.<br />More stories.</h2><ol><li><span>01</span><p><b>Search a place</b>Use a city, address, or landmark to anchor the map.</p></li><li><span>02</span><p><b>Describe your art</b>Pick a route-art shape and set a target distance.</p></li><li><span>03</span><p><b>Review, then go</b>Inspect the street route, export GPX, and validate it in your navigation app.</p></li></ol></div></section><footer><a className="brand" href="#top"><span className="brand-mark">S</span><span>RouteBuddy</span></a><p>Routes that look like something.</p><span>© 2026 RouteBuddy</span></footer></main>;
}
