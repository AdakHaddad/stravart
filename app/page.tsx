"use client";

import { ChangeEvent, useRef, useState } from "react";

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
  const fileInput = useRef<HTMLInputElement>(null);

  const current = routes[shape];
  const generate = () => {
    if (idea.trim().toLowerCase().includes("bolt")) setShape("bolt");
    if (idea.trim().toLowerCase().includes("flower")) setShape("flower");
    setGenerated(true);
  };
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) { setIdea(event.target.files[0].name.replace(/\.[^/.]+$/, "")); setGenerated(true); }
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Stravart home"><span className="brand-mark">S</span><span>stravart</span></a>
        <nav><a href="#how">How it works</a><a href="#routes">Your routes</a><button className="avatar" aria-label="Profile">MM</button></nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker"><span className="pulse" /> ROUTE ART, MADE REAL</p>
          <h1>Move through the city.<br /><em>Make your mark.</em></h1>
          <p className="lede">Turn an idea into a real route that looks like it on the map. Built for running, riding, and showing off.</p>
          <div className="hero-notes"><span>Road-following routes</span><span>GPX export</span><span>Any city, your pace</span></div>
        </div>
        <div className="hero-map"><RouteMap shape={shape} generated={generated} /><div className="route-label"><strong>{current.name}</strong><span>{current.distance} · {current.fidelity}% fit</span></div></div>
      </section>

      <section className="studio" aria-label="Create a route">
        <div className="studio-heading"><div><p className="section-label">01 / MAKE A ROUTE</p><h2>What do you want<br />to draw today?</h2></div><p>Start with a word, an image, or let the streets surprise you.</p></div>
        <div className="mode-tabs"><button className={mode === "direct" ? "active" : ""} onClick={() => setMode("direct")}>I have an idea</button><button className={mode === "discover" ? "active" : ""} onClick={() => setMode("discover")}>Surprise me</button></div>
        {mode === "direct" ? <div className="creator-grid">
          <div className="idea-panel">
            <label htmlFor="idea">Your idea</label>
            <div className="idea-field"><input id="idea" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Try “heart”, “lightning”, “flower”..." onKeyDown={(e) => e.key === "Enter" && generate()} /><button onClick={generate} aria-label="Generate route">↗</button></div>
            <div className="quick-picks"><span>Quick picks</span>{(["heart", "bolt", "flower"] as Shape[]).map((item) => <button className={shape === item ? "picked" : ""} onClick={() => { setShape(item); setIdea(routes[item].name.replace(" loop", "").replace("Electric ", "").replace("City ", "")); setGenerated(true); }} key={item}>{routes[item].name}</button>)}</div>
            <div className="upload-zone" onClick={() => fileInput.current?.click()} onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()} role="button" tabIndex={0}><input ref={fileInput} type="file" accept="image/*" onChange={upload} /><b>＋</b><span>Drop an image or <u>browse files</u></span><small>JPG, PNG or SVG · Max 10 MB</small></div>
          </div>
          <div className="settings-panel"><div className="setting-title"><label htmlFor="distance">Target distance</label><strong>{distance}.0 km</strong></div><input className="distance" id="distance" type="range" min="3" max="15" value={distance} onChange={(e) => setDistance(Number(e.target.value))} /><div className="range-labels"><span>3 km</span><span>15 km</span></div><div className="location"><span className="pin">◎</span><div><small>STARTING NEAR</small><strong>Jakarta, Indonesia</strong></div><button>Change</button></div><button className="primary" onClick={generate}>{generated ? "Update my route" : "Generate my route"}<span>→</span></button></div>
        </div> : <div className="discovery-panel"><div><p className="section-label">LOCAL DISCOVERY</p><h3>Jakarta is good at curves.</h3><p>We found 14 shapes that fit the street grain around you. These three will draw cleanly at your preferred distance.</p><button className="primary" onClick={() => { setMode("direct"); setShape("heart"); setGenerated(true); }}>See the best fit <span>→</span></button></div><div className="mini-routes">{(["heart", "bolt", "flower"] as Shape[]).map((item) => <button onClick={() => { setShape(item); setMode("direct"); setGenerated(true); }} key={item}><svg viewBox="0 0 500 470"><path d={routes[item].path} /></svg><strong>{routes[item].name}</strong><small>{routes[item].fidelity}% fidelity</small></button>)}</div></div>}
      </section>

      <section className="result" id="routes"><div className="result-top"><div><p className="section-label">02 / YOUR ROUTE</p><h2>{generated ? "Your route is ready." : "A route worth remembering."}</h2></div><p>{generated ? `We matched ${current.name.toLowerCase()} to the roads around Jakarta.` : "Pick a shape and we will make it feel at home in the streets."}</p></div><div className="route-result"><div className="result-map"><RouteMap shape={shape} generated={generated} /></div><div className="route-details"><span className="status"><i /> {generated ? "ROUTE READY" : "WAITING FOR YOUR IDEA"}</span><h3>{current.name}</h3><div className="metrics"><div><strong>{distance}.0 <small>km</small></strong><span>Distance</span></div><div><strong>{generated ? current.fidelity : "--"}<small>%</small></strong><span>Shape fidelity</span></div><div><strong>{distance > 8 ? "1:08" : "36"}<small> min</small></strong><span>Est. run time</span></div></div><div className="route-tip"><b>◌</b><p><strong>Made for your pace</strong><br />A mostly flat loop with one gentle climb near the river.</p></div><button className="download" disabled={!generated} onClick={() => alert("Your GPX route is ready to download.")}>Download GPX <span>↓</span></button><button className="share" disabled={!generated}>Share route</button></div></div></section>

      <section className="steps" id="how"><p className="section-label">HOW IT WORKS</p><div><h2>Less planning.<br />More stories.</h2><ol><li><span>01</span><p><b>Bring an idea</b>Type a word, upload a sketch, or see what your local streets can make.</p></li><li><span>02</span><p><b>We fit the roads</b>Stravart shapes a real, runnable loop using roads that are actually there.</p></li><li><span>03</span><p><b>Go make your mark</b>Export your GPX and take the route wherever you track your movement.</p></li></ol></div></section>
      <footer><a className="brand" href="#top"><span className="brand-mark">S</span><span>stravart</span></a><p>Routes that look like something.</p><span>© 2026 Stravart</span></footer>
    </main>
  );
}
