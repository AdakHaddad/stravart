"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { RouteMapCanvas } from "./route-map";

type Art = "cat" | "catFace" | "heart" | "bolt" | "flower" | "star" | "wave";
type Point = [number, number];
type Place = { center: Point; location: string };
type GeneratedRoute = { coordinates: Point[]; distance: number; duration?: number; kind: Art; location: string; target: number; scale: number };
const defaultCenter: Point = [106.8456, -6.2088];
const FIT_TOLERANCE = .1;
const art: Record<Art, { name: string; path: string; points: Point[] }> = {
  cat: { name: "Cat with tail", path: "M60 220 L70 250 L90 274 L140 320 L210 340 L220 420 L270 420 L260 340 L320 340 L330 420 L380 420 L370 330 L390 290 L410 240 L440 260 L460 210 L440 140 L400 120 L360 220 L200 170 L180 80 L140 150 L80 80 L100 160 Z", points: [[-.95,-.15],[-.9,0],[-.8,.12],[-.55,.35],[-.2,.45],[-.15,.85],[.1,.85],[.05,.45],[.35,.45],[.4,.85],[.65,.85],[.6,.4],[.7,.2],[.8,-.05],[.95,.05],[1.05,-.2],[.95,-.55],[.75,-.65],[.55,-.15],[-.25,-.4],[-.35,-.85],[-.55,-.5],[-.85,-.85],[-.75,-.45],[-.95,-.15]] },
  catFace: { name: "Cat face", path: "M250 405 C195 398 172 374 163 330 L137 112 L207 218 C228 198 272 198 293 218 L363 112 L337 330 C328 374 305 398 250 405Z", points: [[0,.85],[-.65,.55],[-.8,-.05],[-.78,-.8],[-.3,-.35],[0,-.45],[.3,-.35],[.78,-.8],[.8,-.05],[.65,.55],[0,.85]] },
  heart: { name: "Heart loop", path: "M238 385 C92 306 78 164 155 129 C201 109 232 139 250 170 C270 135 300 108 347 128 C424 162 405 307 262 385 C254 390 246 390 238 385Z", points: [[0,.8],[-.75,.3],[-.6,-.4],[0,-.1],[.6,-.4],[.75,.3],[0,.8]] },
  bolt: { name: "Electric bolt", path: "M287 66 L131 245 H218 L189 401 L377 189 H285 Z", points: [[.25,-.85],[-.75,-.05],[-.25,-.05],[-.45,.8],[.85,-.35],[.2,-.35],[.25,-.85]] },
  flower: { name: "City bloom", path: "M250 218 C184 124 97 167 130 238 C68 259 92 351 165 337 C156 414 251 414 250 329 C298 413 382 380 352 318 C437 318 420 226 343 242 C378 164 283 128 250 218Z", points: [[0,-.55],[-.7,-.45],[-.85,.15],[-.35,.65],[0,.15],[.35,.65],[.85,.15],[.7,-.45],[0,-.55]] },
  star: { name: "Star loop", path: "M250 55 L294 190 L437 190 L321 273 L365 414 L250 329 L135 414 L179 273 L63 190 L206 190 Z", points: [[0,-.85],[.25,-.2],[.9,-.2],[.37,.2],[.55,.85],[0,.48],[-.55,.85],[-.37,.2],[-.9,-.2],[-.25,-.2],[0,-.85]] },
  wave: { name: "Wave loop", path: "M70 275 C140 125 220 125 290 275 S440 425 460 210 C390 360 310 360 235 210 S90 65 40 235", points: [[-.9,.2],[-.6,-.55],[-.2,-.55],[.15,.2],[.5,.65],[.85,-.1],[.45,.35],[.05,.35],[-.35,-.25],[-.75,-.25],[-.9,.2]] },
};
const artWords: Record<Art, string[]> = {
  catFace: ["cat face", "cats face", "cat head", "cats head", "kitty face", "kitten face", "kitty head", "kitten head", "cat portrait", "face of a cat", "cat visage"],
  cat: ["cat", "kitten", "kitty", "kitties", "feline", "meow", "paw", "tomcat", "cat with tail", "cat with a tail", "full cat", "whole cat", "cat body", "cat silhouette", "walking cat", "sitting cat", "cat outline", "cat shape", "cat drawing", "cat figure", "cat form", "cat logo", "cat art"],
  heart: ["heart", "love", "valentine", "romance", "romantic", "love heart"],
  bolt: ["bolt", "lightning", "thunder", "electric", "electricity", "energy", "zap", "flash"],
  flower: ["flower", "bloom", "blossom", "rose", "petal", "daisy", "daisies", "tulip", "floral"],
  star: ["star", "starry", "constellation", "night sky", "celestial"],
  wave: ["wave", "ocean", "sea", "water", "surf", "swell", "ripple"],
};
const chooseArt = (idea: string): Art | null => {
  const text = idea.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const tokens = new Set(text.split(/[^a-z]+/).filter(Boolean));
  const stems = new Set(tokens);
  for (const token of tokens) {
    if (token.length > 3 && token.endsWith("s")) stems.add(token.slice(0, -1));
  }
  for (const [kind, words] of Object.entries(artWords) as [Art, string[]][]) {
    if (words.some((word) => word.includes(" ") ? text.includes(word) : stems.has(word))) return kind;
  }
  return null;
};
function waypoints(kind: Art, center: Point, distance: number, scale = .006 + distance * .00085): Point[] {
  return art[kind].points.map(([x, y]) => [center[0] + x * scale / Math.cos(center[1] * Math.PI / 180), center[1] - y * scale]);
}
function routeLength(points: Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index++) {
    const [lon1, lat1] = points[index - 1]; const [lon2, lat2] = points[index];
    const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    total += 2 * 6371000 * Math.asin(Math.sqrt(a));
  }
  return total;
}
function ArtPreview({ center, points, outline }: { center: Point; points: Point[]; outline?: Point[] }) {
  const all = outline?.length ? [...points, ...outline] : points;
  if (all.length < 2) return null;
  const lonScale = Math.cos(center[1] * Math.PI / 180);
  const offsets = all.map(([lon, lat]) => [(lon - center[0]) * lonScale, lat - center[1]] as const);
  const extent = Math.max(...offsets.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)]), 0.00001);
  const polyline = (list: Point[]) => list.map(([lon, lat]) => `${(50 + (lon - center[0]) * lonScale / extent * 34).toFixed(2)},${(50 - (lat - center[1]) / extent * 34).toFixed(2)}`).join(" ");
  const coords = polyline(points);
  const [startX, startY] = coords ? coords.split(" ")[0].split(",") : [];
  return <svg className="map-fallback" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    {outline?.length ? <polyline points={polyline(outline)} fill="none" stroke="#d8ff40" strokeWidth="3" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" /> : null}
    <polyline points={coords} fill="none" stroke="#f7f6ee" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points={coords} fill="none" stroke="#10221f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    {startX && startY ? <circle cx={startX} cy={startY} r="2.6" fill="#d8ff40" stroke="#10221f" strokeWidth="1.2" /> : null}
  </svg>;
}
function Map({ kind, center, points, outline, onPick, pickHint }: { kind: Art; center: Point; points: Point[]; outline?: Point[]; onPick?: (center: Point) => void; pickHint?: string }) {
  return <div className="map" aria-label={`${art[kind].name} route preview`}>
    <ArtPreview center={center} points={points} outline={outline} />
    <RouteMapCanvas center={center} points={points} outline={outline} onPick={onPick} />
    {outline?.length ? <div className="map-legend"><span className="legend-target" />Target art<span className="legend-route" />Walkable route</div> : null}
    {onPick ? <div className="map-pick-hint">{pickHint ?? "Click map to choose an area"}</div> : null}
    <div className="map-credit">© OpenStreetMap contributors</div>
  </div>;
}
const xmlEscapes: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" };
const xml = (value: string) => value.replace(/[<>&'\"]/g, (character) => xmlEscapes[character]);
function downloadGpx(name: string, points: Point[], distance: number, location: string) {
  const tracks = points.map(([lon, lat]) => `    <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}" />`).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="RouteBuddy" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${xml(name)}</name><desc>${distance.toFixed(1)} km near ${xml(location)}</desc></metadata><trk><name>${xml(name)}</name><trkseg>\n${tracks}\n</trkseg></trk></gpx>`;
  const url = URL.createObjectURL(new Blob([body], { type: "application/gpx+xml" })); const link = document.createElement("a"); link.href = url; link.download = `RouteBuddy-${name.replaceAll(" ", "-")}.gpx`; link.click(); URL.revokeObjectURL(url);
}

export default function Home() {
  const [idea, setIdea] = useState("");
  const [kind, setKind] = useState<Art>("heart");
  const [location, setLocation] = useState("Jakarta, Indonesia");
  const [center, setCenter] = useState<Point>(defaultCenter);
  const [distance, setDistance] = useState(6);
  const [generated, setGenerated] = useState<GeneratedRoute | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [picking, setPicking] = useState(false);
  const pickRequest = useRef(0);
  const blurTimer = useRef<number | null>(null);
  const previews = useMemo(() => waypoints(kind, center, distance), [kind, center, distance]);
  const ready = generated !== null;
  const resultKind = generated?.kind ?? kind;
  const resultPoints = generated?.coordinates ?? previews;
  const resultLocation = generated?.location ?? location;
  const resultDistance = generated ? generated.distance / 1000 : distance;
  const resultOutline = useMemo(() => generated ? waypoints(generated.kind, center, generated.target, generated.scale) : undefined, [generated, center]);
  const canSuggest = locationFocused && !picking && selectedPlace?.location !== location.trim();
  useEffect(() => {
    if (!locationFocused || picking) return;
    const query = location.trim();
    if (query.length < 2 || selectedPlace?.location === query) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&limit=6`, { signal: controller.signal });
        if (!response.ok) throw new Error("search");
        const payload = await response.json() as { results?: Place[] };
        if (controller.signal.aborted) return;
        setSuggestions(payload.results ?? []);
        setActiveSuggestion(-1);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [location, locationFocused, selectedPlace, picking]);
  async function generate() {
    if (!idea.trim()) return setError("Describe the art you want to make, or choose a quick pick.");
    const nextKind = chooseArt(idea);
    if (!nextKind) return setError("That shape isn’t in the route-art library yet. Try cat, cat face, heart, star, flower, bolt, or wave.");
    if (!location.trim()) return setError("Search a city, address, or landmark first.");
    setBusy(true); setError(""); setMessage("");
    try {
      const trimmedLocation = location.trim();
      let place: Place | undefined = selectedPlace?.location === trimmedLocation ? selectedPlace : undefined;
      if (!place) {
        const lookup = await fetch(`/api/geocode?q=${encodeURIComponent(trimmedLocation)}&limit=1`);
        if (!lookup.ok) throw new Error("search");
        const payload = await lookup.json() as { results?: Place[] };
        place = payload.results?.[0];
        if (!place) { setError("We couldn’t find that place. Try a more specific city, address, or landmark."); return; }
        setSelectedPlace(place);
        setLocation(place.location);
      }
      const nextCenter = place.center;
      const nextLocation = place.location || trimmedLocation;
      setCenter(nextCenter); setLocation(nextLocation);
      const targetMeters = distance * 1000;
      let scale = .006 + distance * .00085;
      let best: { coordinates: Point[]; distance: number; duration?: number } | null = null;
      let bestScale = scale;
      for (let attempt = 0; attempt < 3; attempt++) {
        const points = waypoints(nextKind, nextCenter, distance, scale);
        const direction = await fetch("/api/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coordinates: points }) });
        if (!direction.ok) { if (best) break; throw new Error(direction.status === 429 ? "busy" : "directions"); }
        const payload = await direction.json() as { coordinates?: Point[]; distance?: number; duration?: number };
        if (!payload.coordinates?.length) { if (best) break; throw new Error("empty"); }
        const actual = typeof payload.distance === "number" && payload.distance > 0 ? payload.distance : routeLength(payload.coordinates);
        if (!best || Math.abs(actual - targetMeters) < Math.abs(best.distance - targetMeters)) {
          best = { coordinates: payload.coordinates, distance: actual, duration: payload.duration };
          bestScale = scale;
        }
        if (Math.abs(actual - targetMeters) <= targetMeters * FIT_TOLERANCE) break;
        const factor = targetMeters / actual;
        if (!Number.isFinite(factor)) break;
        scale *= Math.min(2.2, Math.max(.45, factor));
      }
      if (!best) throw new Error("empty");
      setKind(nextKind); setGenerated({ ...best, scale: bestScale, kind: nextKind, location: nextLocation, target: distance });
      const actualKm = best.distance / 1000;
      setMessage(Math.abs(actualKm - distance) / distance <= FIT_TOLERANCE ? "Street-snapped route ready. Review it before you go." : `Closest walkable fit is ${actualKm.toFixed(1)} km for a ${distance} km target.`);
      document.getElementById("routes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (cause) { setError(cause instanceof Error && cause.message === "busy" ? "Street routing is busy right now. Wait a few seconds and try again." : "We couldn’t build a walkable route there. Try a denser area, a shorter distance, or another art prompt."); } finally { setBusy(false); }
  }
  const changeIdea = (value: string) => {
    setIdea(value);
    setError("");
    const nextKind = chooseArt(value);
    if (nextKind && nextKind !== kind) {
      setKind(nextKind);
      setGenerated(null);
      setMessage("");
    }
  };
  const changeLocation = (value: string) => {
    setLocation(value);
    setSelectedPlace(null);
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSearching(false);
    setGenerated(null);
    setMessage("");
    setError("");
  };
  const selectPlace = (place: Place) => {
    if (busy) return;
    setLocation(place.location);
    setSelectedPlace(place);
    setCenter(place.center);
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSearching(false);
    setGenerated(null);
    setMessage("");
    setError("");
  };
  const pickOnMap = async (picked: Point) => {
    if (busy) return;
    const request = ++pickRequest.current;
    const fallback = `Selected area (${picked[1].toFixed(4)}, ${picked[0].toFixed(4)})`;
    setCenter(picked);
    setGenerated(null);
    setMessage("");
    setError("");
    setSelectedPlace(null);
    setSuggestions([]);
    setActiveSuggestion(-1);
    setLocationFocused(false);
    setSearching(false);
    setPicking(true);
    setLocation("Locating map point…");
    try {
      const response = await fetch(`/api/geocode?lat=${picked[1]}&lon=${picked[0]}`);
      const payload = await response.json() as { results?: Place[] };
      if (request !== pickRequest.current) return;
      const label = payload.results?.[0]?.location || fallback;
      setLocation(label);
      setSelectedPlace({ center: picked, location: label });
    } catch {
      if (request !== pickRequest.current) return;
      setLocation(fallback);
      setSelectedPlace({ center: picked, location: fallback });
    } finally {
      if (request === pickRequest.current) setPicking(false);
    }
  };
  const onLocationKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!canSuggest || (!searching && suggestions.length === 0)) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((index) => index <= 0 ? suggestions.length - 1 : index - 1);
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      const place = suggestions[activeSuggestion];
      if (place) {
        event.preventDefault();
        selectPlace(place);
      }
    } else if (event.key === "Escape") {
      event.currentTarget.blur();
    }
  };
  const onLocationFocus = () => {
    if (blurTimer.current !== null) {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    setLocationFocused(true);
  };
  const onLocationBlur = () => {
    blurTimer.current = window.setTimeout(() => {
      blurTimer.current = null;
      setLocationFocused(false);
      setSearching(false);
    }, 120);
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void generate(); };
  return <main><header className="topbar"><a className="brand" href="#top"><span className="brand-mark">S</span><span>RouteBuddy</span></a><nav><a href="#how">How it works</a><a href="#routes">Your route</a></nav></header>
    <section className="hero" id="top"><div className="hero-copy"><p className="kicker"><span className="pulse" /> STREET-LEVEL ROUTE ART</p><h1>Search a place.<br /><em>Make your mark.</em></h1><p className="lede">Turn an art prompt into a walkable route on a real map. Search any city, address, or landmark, then inspect and export the result.</p><div className="hero-notes"><span>Live place search</span><span>Street-snapped routes</span><span>GPX export</span></div></div><div className="hero-map"><Map kind={kind} center={center} points={previews} onPick={pickOnMap} pickHint={picking ? "Finding the nearest place…" : "Click map to choose an area"} /></div></section>
    <section className="studio"><div className="studio-heading"><div><p className="section-label">01 / SEARCH & DRAW</p><h2>What do you want<br />to draw today?</h2></div><p>Choose a place, describe the art, and we’ll try to fit it to walkable streets.</p></div><form className="creator-grid" onSubmit={submit} noValidate><div className="idea-panel"><label htmlFor="idea">Art prompt</label><div className="idea-field"><input id="idea" value={idea} onChange={(e) => changeIdea(e.target.value)} aria-invalid={Boolean(error)} placeholder="Try “cat”, “cat face”, “heart”..." /><button type="submit" aria-label="Generate route" disabled={busy}>↗</button></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="quick-picks"><span>Quick picks</span>{(Object.keys(art) as Art[]).map((item) => <button type="button" className={kind === item ? "picked" : ""} onClick={() => { setKind(item); setIdea(art[item].name); setGenerated(null); setError(""); setMessage(""); }} key={item}>{art[item].name}</button>)}</div></div><div className="settings-panel"><div className="setting-title"><label htmlFor="distance">Target distance</label><strong>{distance}.0 km</strong></div><input className="distance" id="distance" type="range" min="3" max="15" value={distance} onChange={(e) => { setDistance(Number(e.target.value)); setGenerated(null); setMessage(""); }} /><div className="range-labels"><span>3 km</span><span>15 km</span></div><div className="location"><span className="pin">◎</span><div className="location-field"><label htmlFor="location">SEARCH ON THE MAP</label><input id="location" value={location} onChange={(e) => changeLocation(e.target.value)} onFocus={onLocationFocus} onBlur={onLocationBlur} onKeyDown={onLocationKeyDown} placeholder="City, address, or landmark" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={Boolean(canSuggest && (searching || suggestions.length > 0))} aria-controls="location-suggestions" aria-activedescendant={canSuggest && activeSuggestion >= 0 ? `location-suggestion-${activeSuggestion}` : undefined} />{selectedPlace && !picking ? <p className="place-confirmed">✓ Selected: {selectedPlace.location}</p> : null}{picking ? <p className="place-confirmed">Finding the nearest place…</p> : null}{canSuggest && (searching || suggestions.length > 0) ? <div className="suggestions" id="location-suggestions">{searching ? <p className="suggestion-note" aria-live="polite">Searching…</p> : null}<ul role="listbox" aria-label="Place suggestions">{suggestions.map((place, index) => <li id={`location-suggestion-${index}`} key={`${place.location}-${place.center.join(",")}`} role="option" aria-selected={index === activeSuggestion} className={index === activeSuggestion ? "suggestion active" : "suggestion"} onPointerDown={(event) => event.preventDefault()} onClick={() => selectPlace(place)} onMouseEnter={() => setActiveSuggestion(index)}><span className="suggestion-pin" aria-hidden="true">◎</span><span>{place.location}</span></li>)}</ul></div> : null}</div></div><button className="primary" type="submit" disabled={busy}>{busy ? "Finding streets…" : ready ? "Update my route" : "Generate walkable route"}<span>→</span></button><p className="token-note">Routing is secured server-side; no provider key is exposed in your browser.</p></div></form></section>
    <section className="result" id="routes"><div className="result-top"><div><p className="section-label">02 / YOUR ROUTE</p><h2>{ready ? "Your route is ready." : "Ready when you are."}</h2></div><p>{ready ? `We fitted ${art[resultKind].name.toLowerCase()} to streets near ${resultLocation} for a ${generated.target} km target.` : "Search a location and choose an art prompt to generate a walkable route."}</p></div>{message && <p className="action-message" role="status">{message}</p>}<div className="route-result"><div className="result-map"><Map kind={resultKind} center={center} points={resultPoints} outline={resultOutline} /></div><div className="route-details"><span className="status"><i /> {ready ? "ROUTE READY" : "WAITING FOR YOUR SEARCH"}</span><h3>{art[resultKind].name}</h3><div className="metrics"><div><strong>{resultDistance.toFixed(1)} <small>km</small></strong><span>{ready ? "Actual" : "Target"}</span></div><div><strong>{ready ? resultPoints.length : "--"}<small> pts</small></strong><span>Street points</span></div><div><strong>{ready ? "yes" : "--"}</strong><span>Walkable</span></div></div><div className="route-tip"><b>◌</b><p><strong>Always review before heading out</strong><br />Routes use public street data and can change. GPX is a route suggestion, not turn-by-turn navigation.</p></div><button className="download" disabled={!ready} onClick={() => { downloadGpx(art[resultKind].name, resultPoints, resultDistance, resultLocation); setMessage("GPX downloaded. Review it in your navigation app before starting."); }}>Download GPX <span>↓</span></button></div></div></section>
    <section className="steps" id="how"><p className="section-label">HOW IT WORKS</p><div><h2>Less planning.<br />More stories.</h2><ol><li><span>01</span><p><b>Search a place</b>Use a city, address, or landmark to anchor the map.</p></li><li><span>02</span><p><b>Describe your art</b>Pick a route-art shape and set a target distance.</p></li><li><span>03</span><p><b>Review, then go</b>Inspect the street route, export GPX, and validate it in your navigation app.</p></li></ol></div></section><footer><a className="brand" href="#top"><span className="brand-mark">S</span><span>RouteBuddy</span></a><p>Routes that look like something.</p><span>© 2026 RouteBuddy</span></footer></main>;
}
