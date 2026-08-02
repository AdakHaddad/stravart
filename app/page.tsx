"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";

type Shape = "heart" | "bolt" | "flower";

const routes: Record<Shape, { name: string; distance: string; fidelity: number; path: string }> = {
  heart: {
    name: "Heart loop",
    distance: "5.6 km",
    fidelity: 96,
    path: "M238 385 C92 306 78 164 155 129 C201 109 232 139 250 170 C270 135 300 108 347 128 C424 162 405 307 262 385 C254 390 246 390 238 385Z",
  },
  bolt: {
    name: "Electric bolt",
    distance: "6.2 km",
    fidelity: 91,
    path: "M287 66 L131 245 H218 L189 401 L377 189 H285 Z",
  },
  flower: {
    name: "City bloom",
    distance: "4.8 km",
    fidelity: 88,
    path: "M250 218 C184 124 97 167 130 238 C68 259 92 351 165 337 C156 414 251 414 250 329 C298 413 382 380 352 318 C437 318 420 226 343 242 C378 164 283 128 250 218Z",
  },
};

const cities = ["Jakarta, Indonesia", "Bandung, Indonesia", "Yogyakarta, Indonesia"];

function getShapeFromIdea(idea: string, fallback: Shape): Shape {
  const value = idea.toLowerCase();
  if (value.includes("bolt") || value.includes("lightning")) return "bolt";
  if (value.includes("flower") || value.includes("bloom")) return "flower";
  if (value.includes("heart") || value.includes("love")) return "heart";
  return fallback;
}

function downloadGpx(shape: Shape, distance: number, location: string) {
  const route = routes[shape];
  const center = { lat: -6.2088, lon: 106.8456 };
  const points = shape === "bolt" ? [[0.02, -0.01], [-0.02, 0.005], [0.004, 0.005], [-0.01, 0.025], [0.025, -0.004], [0.005, -0.004], [0.02, -0.01]] : shape === "flower" ? [[0, -0.017], [-0.016, -0.006], [-0.02, 0.012], [0, 0.016], [0.02, 0.012], [0.016, -0.006], [0, -0.017]] : [[0, 0.02], [-0.024, -0.004], [-0.012, -0.022], [0, -0.006], [0.012, -0.022], [0.024, -0.004], [0, 0.02]];
  const trackPoints = points.map(([lat, lon]) => `    <trkpt lat="${(center.lat + lat).toFixed(6)}" lon="${(center.lon + lon).toFixed(6)}" />`).join("\n");
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="RouteBuddy" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${route.name}</name><desc>${distance} km route concept near ${location}</desc></metadata>\n  <trk><name>${route.name}</name><trkseg>\n${trackPoints}\n  </trkseg></trk>\n</gpx>`;
  const url = URL.createObjectURL(new Blob([gpx], { type: "application/gpx+xml" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `RouteBuddy-${shape}-${distance}km.gpx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function RouteMap({ shape, generated }: { shape: Shape; generated: boolean }) {
  const item = routes[shape];
  return (
    <div className="map" aria-label={`${item.name} route preview`}>
      <div className="map-grid" />
      <span className="road road-a" /><span className="road road-b" /><span className="road road-c" />
      <span className="road road-d" /><span className="road road-e" /><span className="road road-f" />
      <span className="place place-one">RIVER</span><span className="place place-two">EAST VILLAGE</span>
      <svg viewBox="0 0 500 470" className={`route-svg ${generated ? "route-ready" : ""}`} role="img">
        <path d={item.path} className="route-underlay" />
        <path d={item.path} className="route-line" pathLength="1" />
        <circle cx="250" cy="170" r="7" className="route-dot" />
      </svg>
      <div className="map-scale"><span /> 500 m</div>
      <div className="map-credit">© OpenStreetMap contributors</div>
    </div>
  );
}

export default function Home() {
  const [idea, setIdea] = useState("");
  const [shape, setShape] = useState<Shape>("heart");
  const [distance, setDistance] = useState(6);
  const [generated, setGenerated] = useState(false);
  const [mode, setMode] = useState<"direct" | "discover">("direct");
  const [location, setLocation] = useState(cities[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [ideaError, setIdeaError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const current = routes[shape];
  const generate = () => {
    if (!idea.trim()) {
      setIdeaError("Enter an idea or choose a quick pick to generate a route.");
      return;
    }
    setIdeaError("");
    setMessage("");
    setIsGenerating(true);
    window.setTimeout(() => {
      setShape(getShapeFromIdea(idea, shape));
      setGenerated(true);
      setIsGenerating(false);
      setMessage("Route ready. Download or share it below.");
      document.getElementById("routes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 450);
  };
  const submitIdea = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); generate(); };
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setIdeaError("Choose a JPG, PNG, or SVG image smaller than 10 MB.");
      event.target.value = "";
      return;
    }
    setIdea(file.name.replace(/\.[^/.]+$/, ""));
    setIdeaError("");
    setMessage(`Sketch “${file.name}” attached. Generate when you’re ready.`);
    event.target.value = "";
  };
  const share = async () => {
    const text = `I made a ${distance} km ${current.name.toLowerCase()} with RouteBuddy near ${location}.`;
    const canShare = "share" in navigator;
    try {
      if (canShare) await navigator.share({ title: "My RouteBuddy route", text, url: window.location.href });
      else await navigator.clipboard.writeText(`${text} ${window.location.href}`);
      setMessage(canShare ? "Share sheet opened." : "Route link copied to your clipboard.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Sharing is unavailable in this browser. You can still download the GPX file.");
    }
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="RouteBuddy home"><span className="brand-mark">S</span><span>RouteBuddy</span></a>
        <nav><a href="#how">How it works</a><a href="#routes">Your routes</a><button className="avatar" aria-label="Profile">MM</button></nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker"><span className="pulse" /> ROUTE ART, MADE REAL</p>
          <h1>Move through the city.<br /><em>Make your mark.</em></h1>
          <p className="lede">Turn an idea into a route concept that looks like it on the map. Built for running, riding, and sharing.</p>
          <div className="hero-notes"><span>Shape-led route concepts</span><span>GPX export</span><span>Review before you go</span></div>
        </div>
        <div className="hero-map"><RouteMap shape={shape} generated={generated} /><div className="route-label"><strong>{current.name}</strong><span>{current.distance} · {current.fidelity}% fit</span></div></div>
      </section>

      <section className="studio" aria-label="Create a route">
        <div className="studio-heading"><div><p className="section-label">01 / MAKE A ROUTE</p><h2>What do you want<br />to draw today?</h2></div><p>Start with a word, an image, or let the streets surprise you.</p></div>
        <div className="mode-tabs"><button className={mode === "direct" ? "active" : ""} onClick={() => setMode("direct")}>I have an idea</button><button className={mode === "discover" ? "active" : ""} onClick={() => setMode("discover")}>Surprise me</button></div>
        {mode === "direct" ? <form className="creator-grid" onSubmit={submitIdea} noValidate>
          <div className="idea-panel">
            <label htmlFor="idea">Your idea</label>
            <div className="idea-field"><input id="idea" value={idea} onChange={(e) => { setIdea(e.target.value); setIdeaError(""); }} aria-invalid={Boolean(ideaError)} aria-describedby={ideaError ? "idea-error" : undefined} placeholder="Try “heart”, “lightning”, “flower”..." /><button type="submit" aria-label="Generate route" disabled={isGenerating}>↗</button></div>
            {ideaError && <p className="form-error" id="idea-error" role="alert">{ideaError}</p>}
            <div className="quick-picks"><span>Quick picks</span>{(["heart", "bolt", "flower"] as Shape[]).map((item) => <button type="button" className={shape === item ? "picked" : ""} onClick={() => { setShape(item); setIdea(routes[item].name.replace(" loop", "").replace("Electric ", "").replace("City ", "")); setGenerated(true); setIdeaError(""); setMessage(`${routes[item].name} selected.`); }} key={item}>{routes[item].name}</button>)}</div>
            <div className="upload-zone" onClick={() => fileInput.current?.click()} onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()} role="button" tabIndex={0}><input ref={fileInput} type="file" accept="image/*" onChange={upload} /><b>＋</b><span>Drop an image or <u>browse files</u></span><small>JPG, PNG or SVG · Max 10 MB</small></div>
          </div>
          <div className="settings-panel"><div className="setting-title"><label htmlFor="distance">Target distance</label><strong>{distance}.0 km</strong></div><input className="distance" id="distance" type="range" min="3" max="15" value={distance} onChange={(e) => setDistance(Number(e.target.value))} /><div className="range-labels"><span>3 km</span><span>15 km</span></div><div className="location"><span className="pin">◎</span><div><label htmlFor="location">STARTING NEAR</label><select id="location" value={location} onChange={(e) => setLocation(e.target.value)}>{cities.map((city) => <option key={city}>{city}</option>)}</select></div></div><button className="primary" type="submit" disabled={isGenerating}>{isGenerating ? "Generating route…" : generated ? "Update my route" : "Generate my route"}<span>→</span></button></div>
        </form> : <div className="discovery-panel"><div><p className="section-label">LOCAL DISCOVERY</p><h3>Jakarta is good at curves.</h3><p>We found 14 shapes that fit the street grain around you. These three will draw cleanly at your preferred distance.</p><button className="primary" type="button" onClick={() => { setMode("direct"); setShape("heart"); setIdea("heart"); setGenerated(true); setMessage("Heart loop selected."); }}>See the best fit <span>→</span></button></div><div className="mini-routes">{(["heart", "bolt", "flower"] as Shape[]).map((item) => <button type="button" onClick={() => { setShape(item); setIdea(item); setMode("direct"); setGenerated(true); setMessage(`${routes[item].name} selected.`); }} key={item}><svg viewBox="0 0 500 470"><path d={routes[item].path} /></svg><strong>{routes[item].name}</strong><small>{routes[item].fidelity}% fidelity</small></button>)}</div></div>}
      </section>

      <section className="result" id="routes"><div className="result-top"><div><p className="section-label">02 / YOUR ROUTE</p><h2>{generated ? "Your route is ready." : "A route worth remembering."}</h2></div><p>{generated ? `We matched ${current.name.toLowerCase()} to your route concept near ${location}.` : "Pick a shape and we will make it feel at home in the streets."}</p></div>{message && <p className="action-message" role="status" aria-live="polite">{message}</p>}<div className="route-result"><div className="result-map"><RouteMap shape={shape} generated={generated} /></div><div className="route-details"><span className="status"><i /> {generated ? "ROUTE READY" : "WAITING FOR YOUR IDEA"}</span><h3>{current.name}</h3><div className="metrics"><div><strong>{distance}.0 <small>km</small></strong><span>Distance</span></div><div><strong>{generated ? current.fidelity : "--"}<small>%</small></strong><span>Shape fidelity</span></div><div><strong>{distance > 8 ? "1:08" : "36"}<small> min</small></strong><span>Est. run time</span></div></div><div className="route-tip"><b>◌</b><p><strong>Made for your pace</strong><br />Review your route in a mapping app before heading out; GPX exports are route concepts, not turn-by-turn navigation.</p></div><button className="download" disabled={!generated} onClick={() => { downloadGpx(shape, distance, location); setMessage("GPX file downloaded. Open it in your preferred route app to review."); }}>Download GPX <span>↓</span></button><button className="share" type="button" disabled={!generated} onClick={share}>Share route</button></div></div></section>

      <section className="steps" id="how"><p className="section-label">HOW IT WORKS</p><div><h2>Less planning.<br />More stories.</h2><ol><li><span>01</span><p><b>Bring an idea</b>Type a word, upload a sketch, or see what a shape can become.</p></li><li><span>02</span><p><b>Shape the concept</b>RouteBuddy turns your prompt into a simple loop you can inspect on the map.</p></li><li><span>03</span><p><b>Review, then go</b>Export your GPX, verify it in your route app, and take it wherever you track movement.</p></li></ol></div></section>
      <footer><a className="brand" href="#top"><span className="brand-mark">S</span><span>RouteBuddy</span></a><p>Routes that look like something.</p><span>© 2026 RouteBuddy</span></footer>
    </main>
  );
}
