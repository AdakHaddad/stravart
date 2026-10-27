"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { RouteMapCanvas, type MapBounds } from "./route-map";

type Art = "cat" | "catFace" | "dog" | "bird" | "fish" | "butterfly" | "heart" | "bolt" | "flower" | "star" | "wave" | "house" | "tree" | "sun" | "moon" | "mountain" | "bicycle" | "dinosaur" | "abstract";
type Point = [number, number];
type SearchArea = MapBounds;
type Place = { center: Point; location: string };
type ShapeTransform = { name: string; scale: number; stretchX?: number; stretchY?: number; rotation?: number; offsetX?: number; offsetY?: number; mirror?: boolean };
type RouteCandidate = { kind: Art; shapeName: string; variant: string; targetDistance: number; outline: Point[]; name: string };
type ResolvedShape = { kind: Art; label: string; points: Point[]; isAbstract: boolean };
type GeneratedRoute = { coordinates: Point[]; distance: number; duration?: number; kind: Art; shapeName: string; prompt: string; location: string; target: number; outline: Point[]; quality: number; candidateName: string };
const defaultCenter: Point = [106.8456, -6.2088];
const MAX_CANDIDATES = 217;
const MIN_ROUTE_QUALITY = 56;
const art: Record<Art, { name: string; path: string; points: Point[] }> = {
  cat: { name: "Cat with tail", path: "M60 220 L70 250 L90 274 L140 320 L210 340 L220 420 L270 420 L260 340 L320 340 L330 420 L380 420 L370 330 L390 290 L410 240 L440 260 L460 210 L440 140 L400 120 L360 220 L200 170 L180 80 L140 150 L80 80 L100 160 Z", points: [[-.95,-.15],[-.9,0],[-.8,.12],[-.55,.35],[-.2,.45],[-.15,.85],[.1,.85],[.05,.45],[.35,.45],[.4,.85],[.65,.85],[.6,.4],[.7,.2],[.8,-.05],[.95,.05],[1.05,-.2],[.95,-.55],[.75,-.65],[.55,-.15],[-.25,-.4],[-.35,-.85],[-.55,-.5],[-.85,-.85],[-.75,-.45],[-.95,-.15]] },
  catFace: { name: "Cat face", path: "M250 405 C195 398 172 374 163 330 L137 112 L207 218 C228 198 272 198 293 218 L363 112 L337 330 C328 374 305 398 250 405Z", points: [[0,.85],[-.65,.55],[-.8,-.05],[-.78,-.8],[-.3,-.35],[0,-.45],[.3,-.35],[.78,-.8],[.8,-.05],[.65,.55],[0,.85]] },
  dog: { name: "Dog", path: "", points: [[-.92,-.08],[-.78,.08],[-.58,.1],[-.5,.45],[-.34,.46],[-.28,.1],[.05,.12],[.18,.48],[.36,.48],[.34,.08],[.56,.02],[.68,-.16],[.88,-.08],[.94,-.25],[.78,-.35],[.65,-.31],[.53,-.55],[.35,-.56],[.2,-.3],[-.18,-.28],[-.45,-.24],[-.66,-.2],[-.92,-.08]] },
  bird: { name: "Bird", path: "", points: [[-.9,.18],[-.55,-.12],[-.12,-.5],[.05,-.08],[.42,-.42],[.32,-.02],[.66,-.22],[.47,.1],[.88,.22],[.45,.3],[.12,.62],[-.12,.28],[-.55,.34],[-.9,.18]] },
  fish: { name: "Fish", path: "", points: [[-.85,0],[-.45,-.36],[.1,-.48],[.55,-.26],[.9,-.58],[.82,0],[.9,.58],[.55,.26],[.1,.48],[-.45,.36],[-.85,0]] },
  butterfly: { name: "Butterfly", path: "", points: [[0,.82],[-.12,.2],[-.58,.72],[-.92,.58],[-.88,.08],[-.3,-.05],[-.86,-.6],[-.48,-.78],[0,-.3],[.48,-.78],[.86,-.6],[.3,-.05],[.88,.08],[.92,.58],[.58,.72],[.12,.2],[0,.82]] },
  heart: { name: "Heart loop", path: "M238 385 C92 306 78 164 155 129 C201 109 232 139 250 170 C270 135 300 108 347 128 C424 162 405 307 262 385 C254 390 246 390 238 385Z", points: [[0,.8],[-.75,.3],[-.6,-.4],[0,-.1],[.6,-.4],[.75,.3],[0,.8]] },
  bolt: { name: "Electric bolt", path: "M287 66 L131 245 H218 L189 401 L377 189 H285 Z", points: [[.25,-.85],[-.75,-.05],[-.25,-.05],[-.45,.8],[.85,-.35],[.2,-.35],[.25,-.85]] },
  flower: { name: "City bloom", path: "M250 218 C184 124 97 167 130 238 C68 259 92 351 165 337 C156 414 251 414 250 329 C298 413 382 380 352 318 C437 318 420 226 343 242 C378 164 283 128 250 218Z", points: [[0,-.55],[-.7,-.45],[-.85,.15],[-.35,.65],[0,.15],[.35,.65],[.85,.15],[.7,-.45],[0,-.55]] },
  star: { name: "Star loop", path: "M250 55 L294 190 L437 190 L321 273 L365 414 L250 329 L135 414 L179 273 L63 190 L206 190 Z", points: [[0,-.85],[.25,-.2],[.9,-.2],[.37,.2],[.55,.85],[0,.48],[-.55,.85],[-.37,.2],[-.9,-.2],[-.25,-.2],[0,-.85]] },
  wave: { name: "Wave loop", path: "M70 275 C140 125 220 125 290 275 S440 425 460 210 C390 360 310 360 235 210 S90 65 40 235", points: [[-.9,.2],[-.6,-.55],[-.2,-.55],[.15,.2],[.5,.65],[.85,-.1],[.45,.35],[.05,.35],[-.35,-.25],[-.75,-.25],[-.9,.2]] },
  house: { name: "House", path: "", points: [[-.8,.2],[0,-.72],[.8,.2],[.58,.2],[.58,.82],[-.58,.82],[-.58,.2],[-.8,.2]] },
  tree: { name: "Tree", path: "", points: [[-.14,.85],[.14,.85],[.14,.45],[.68,.45],[.22,.02],[.6,.02],[.12,-.48],[.4,-.48],[0,-.9],[-.4,-.48],[-.12,-.48],[-.6,.02],[-.22,.02],[-.68,.45],[-.14,.45],[-.14,.85]] },
  sun: { name: "Sun", path: "", points: [[0,-.42],[.25,-.7],[.35,-.35],[.72,-.35],[.48,0],[.76,.28],[.36,.32],[.25,.72],[0,.45],[-.25,.72],[-.36,.32],[-.76,.28],[-.48,0],[-.72,-.35],[-.35,-.35],[0,-.42]] },
  moon: { name: "Crescent moon", path: "", points: [[.38,-.82],[.12,-.7],[-.1,-.42],[-.18,-.08],[-.1,.3],[.16,.62],[.52,.76],[.18,.84],[-.24,.68],[-.58,.36],[-.72,-.08],[-.62,-.48],[-.34,-.76],[.02,-.88],[.38,-.82]] },
  mountain: { name: "Mountain", path: "", points: [[-.92,.76],[-.38,-.12],[-.08,.28],[.38,-.72],[.92,.76],[-.92,.76]] },
  bicycle: { name: "Bicycle", path: "", points: [[-.7,.42],[-.92,.42],[-.7,.42],[-.42,-.05],[-.7,.42],[-.88,.68],[-.58,.68],[-.7,.42],[-.42,-.05],[-.05,.6],[-.42,-.05],[.08,-.05],[.35,.42],[.08,-.05],[.48,-.52],[.35,.42],[.72,.42],[.48,-.52],[.22,-.52],[.35,-.35],[.58,-.35]] },
  dinosaur: { name: "Dinosaur", path: "", points: [[-.9,.18],[-.75,.28],[-.63,.48],[-.4,.48],[-.25,.2],[.05,.24],[.22,.5],[.48,.48],[.62,.28],[.78,.25],[.92,.42],[.78,.53],[.57,.52],[.45,.3],[.5,-.18],[.36,-.68],[.16,-.68],[.13,-.32],[-.18,-.3],[-.28,-.68],[-.08,-.75],[-.42,-.75],[-.54,-.3],[-.73,-.08],[-.9,.18]] },
  abstract: { name: "Abstract line", path: "", points: [[0,-.85],[.48,-.66],[.84,-.2],[.64,.36],[.18,.78],[-.38,.7],[-.82,.28],[-.76,-.3],[-.35,-.72],[0,-.85]] },
};
const artWords: Record<Art, string[]> = {
  catFace: ["cat face", "cats face", "cat head", "cats head", "kitty face", "kitten face", "kitty head", "kitten head", "cat portrait", "face of a cat", "cat visage"],
  cat: ["cat", "kitten", "kitty", "kitties", "feline", "meow", "paw", "tomcat", "cat with tail", "cat with a tail", "full cat", "whole cat", "cat body", "cat silhouette", "walking cat", "sitting cat", "cat outline", "cat shape", "cat drawing", "cat figure", "cat form", "cat logo", "cat art"],
  dog: ["dog", "puppy", "puppies", "pup", "canine", "corgi", "shiba", "dog silhouette"],
  bird: ["bird", "eagle", "owl", "raven", "duck", "penguin", "sparrow", "parrot", "flying bird"],
  fish: ["fish", "shark", "whale", "dolphin", "goldfish", "koi", "sea creature"],
  butterfly: ["butterfly", "moth", "winged insect"],
  heart: ["heart", "love", "valentine", "romance", "romantic", "love heart"],
  bolt: ["bolt", "lightning", "thunder", "electric", "electricity", "energy", "zap", "flash"],
  flower: ["flower", "bloom", "blossom", "rose", "petal", "daisy", "daisies", "tulip", "floral"],
  star: ["star", "starry", "constellation", "night sky", "celestial"],
  wave: ["wave", "ocean", "sea", "water", "surf", "swell", "ripple"],
  house: ["house", "home", "cabin", "building", "cottage", "hut"],
  tree: ["tree", "pine", "pine tree", "palm", "palm tree", "forest tree"],
  sun: ["sun", "sunshine", "sunburst"],
  moon: ["moon", "crescent", "crescent moon"],
  mountain: ["mountain", "mountains", "hill", "volcano", "peak"],
  bicycle: ["bicycle", "bike", "cycling", "cycle"],
  dinosaur: ["dinosaur", "dino", "t rex", "tyrannosaurus"],
  abstract: [],
};
const catVariants: Array<{ name: string; points: Point[] }> = [
  { name: art.cat.name, points: art.cat.points },
  // Curated, simplified Quick, Draw! cat sketches; source keys and license are listed in README.
  { name: "Side-profile cat", points: [[-.39,-.21],[.18,-.31],[.47,-.16],[.67,-.14],[.75,-.27],[.7,-.59],[.82,-.72],[.95,-.74],[1,-.54],[.98,-.03],[.91,.03],[.63,.09],[.65,.58],[.6,.64],[.46,.48],[.41,.27],[.36,.43],[.4,.67],[.34,.7],[.24,.6],[.14,.26],[-.08,.21],[-.14,.22],[-.18,.33],[-.08,.64],[-.11,.71],[-.18,.75],[-.26,.67],[-.37,.23],[-.44,.3],[-.45,.43],[-.4,.71],[-.46,.68],[-.58,.49],[-.64,.13],[-.91,-.05],[-1,-.45],[-.87,-.4],[-.8,-.57],[-.65,-.35],[-.55,-.33],[-.39,-.21]] },
  { name: "Raised-tail cat", points: [[-1,-.03],[-.65,-.12],[.29,-.14],[.44,-.29],[.35,-.51],[.36,-.6],[.44,-.65],[.44,-.75],[.58,-.61],[.71,-.62],[.85,-.75],[.8,-.59],[1,-.47],[.85,-.34],[.72,-.3],[.68,-.19],[.7,.65],[.56,.51],[.46,.18],[.51,.73],[.31,.58],[.24,.17],[-.52,.23],[-.54,.75],[-.61,.73],[-.71,.56],[-.7,.21],[-.82,.68],[-.84,.73],[-.91,.73],[-.98,.58],[-.98,.45],[-.91,.26],[-1,-.03]] },
  { name: "Low walking cat", points: [[-.98,-.28],[-.82,-.14],[-.9,.02],[-.72,.14],[-.56,.08],[-.46,-.12],[-.22,-.18],[.05,-.15],[.32,-.18],[.44,-.34],[.45,-.72],[.61,-.44],[.77,-.7],[.82,-.28],[.95,-.1],[.9,.08],[.74,.17],[.72,.78],[.54,.78],[.54,.2],[.32,.18],[.28,.78],[.1,.78],[.12,.18],[-.2,.16],[-.24,.78],[-.42,.78],[-.4,.1],[-.62,.16],[-.78,.04],[-.65,-.1],[-.81,-.28],[-.98,-.28]] },
  { name: "Sitting cat", points: [[-.62,.82],[-.42,.82],[-.36,.36],[-.26,.18],[-.22,-.36],[-.48,-.67],[-.42,-.88],[-.16,-.48],[.05,-.52],[.25,-.9],[.42,-.82],[.32,-.58],[.2,-.35],[.27,.14],[.42,.3],[.5,.82],[.7,.82],[.7,.28],[.56,.03],[.6,-.3],[.48,-.54],[.55,-.72],[.72,-.72],[.86,-.51],[.82,-.25],[.66,-.08],[.66,.18],[.78,.34],[.75,.55],[.54,.58],[.35,.42],[-.15,.42],[-.38,.28],[-.62,.82]] },
  { name: art.catFace.name, points: [[.3,.61],[-.23,.65],[-.62,.55],[-.9,.39],[-1,.11],[-.87,-.05],[-.6,-.15],[-.58,-.65],[-.54,-.65],[-.37,-.4],[-.31,-.39],[.69,-.44],[.77,-.63],[.98,-.11],[.98,.16],[.65,.47],[.3,.61]] },
];
const routeArtCatalog: Array<{ kind: Art; name: string; points: Point[] }> = [
  ...catVariants.map((variant) => ({ kind: "cat" as const, ...variant })),
  ...(Object.keys(art) as Art[])
    .filter((kind) => !["abstract", "cat", "catFace"].includes(kind))
    .map((kind) => ({ kind, name: art[kind].name, points: art[kind].points })),
];
function abstractPoints(prompt: string): Point[] {
  let seed = 2166136261;
  for (const character of prompt.toLowerCase()) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0xffffffff; };
  const count = 12;
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = -Math.PI / 2 + index / count * Math.PI * 2;
    const radius = .58 + random() * .35;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}
function resolveArtPrompt(prompt: string): ResolvedShape {
  const text = prompt.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  if (!text) return { kind: "heart", label: art.heart.name, points: art.heart.points, isAbstract: false };
  const matches: Array<{ kind: Art; start: number; end: number; length: number }> = [];
  for (const [kind, words] of Object.entries(artWords) as [Art, string[]][]) {
    for (const word of words) {
      const normalized = word.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const aliases = normalized.includes(" ") || normalized.endsWith("s") ? [normalized] : [normalized, `${normalized}s`];
      for (const alias of aliases) {
        let start = text.indexOf(alias);
        while (start >= 0) {
          const end = start + alias.length;
          if ((start === 0 || text[start - 1] === " ") && (end === text.length || text[end] === " ")) matches.push({ kind, start, end, length: alias.length });
          start = text.indexOf(alias, start + 1);
        }
      }
    }
  }
  matches.sort((a, b) => a.start - b.start || b.length - a.length);
  const selected: typeof matches = [];
  for (const match of matches) {
    if (selected.some((item) => match.start < item.end && item.start < match.end)) continue;
    if (!selected.some((item) => item.kind === match.kind)) selected.push(match);
  }
  const components = selected.slice(0, 2);
  if (!components.length) return { kind: "abstract", label: `Abstract line for “${prompt.trim().slice(0, 42)}”`, points: abstractPoints(prompt), isAbstract: true };
  const kind = components[0].kind;
  if (components.length === 1) return { kind, label: art[kind].name, points: art[kind].points, isAbstract: false };
  const relation = text.includes(" under ") || text.includes(" below ") ? "under" : text.includes(" above ") || text.includes(" over ") ? "above" : "beside";
  const placements: Array<{ scale: number; x: number; y: number }> = relation === "under"
    ? [{ scale: .5, x: 0, y: -.25 }, { scale: .34, x: 0, y: .58 }]
    : relation === "above"
      ? [{ scale: .5, x: 0, y: .28 }, { scale: .34, x: 0, y: -.56 }]
      : [{ scale: .55, x: -.38, y: 0 }, { scale: .34, x: .58, y: .05 }];
  const points = components.flatMap((component, index) => {
    const placement = placements[index];
    return art[component.kind].points.map(([x, y]) => [x * placement.scale + placement.x, y * placement.scale + placement.y] as Point);
  });
  return { kind, label: components.map((component) => art[component.kind].name).join(" + "), points, isAbstract: false };
}
function discoveryShape(): ResolvedShape {
  return { kind: "abstract", label: "Best fit from the art library", points: [], isAbstract: false };
}
function normalizedLength(points: Point[]) {
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    const dx = points[index][0] - points[index - 1][0];
    const dy = points[index][1] - points[index - 1][1];
    length += Math.hypot(dx, dy);
  }
  return Math.max(length, 0.1);
}
function waypoints(kind: Art, center: Point, distance: number, transform: ShapeTransform = { name: "balanced", scale: 1 }, points = art[kind].points): Point[] {
  const metersPerShapeUnit = distance * 1000 / (normalizedLength(points) * 1.12) * transform.scale;
  const stretchX = (transform.mirror ? -1 : 1) * (transform.stretchX ?? 1);
  const stretchY = transform.stretchY ?? 1;
  const angle = (transform.rotation ?? 0) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const lonScale = Math.cos(center[1] * Math.PI / 180);
  return points.map(([x, y]) => {
    const stretchedX = x * stretchX;
    const stretchedY = y * stretchY;
    const rotatedX = stretchedX * cos - stretchedY * sin + (transform.offsetX ?? 0);
    const rotatedY = stretchedX * sin + stretchedY * cos + (transform.offsetY ?? 0);
    return [center[0] + rotatedX * metersPerShapeUnit / (111_320 * lonScale), center[1] - rotatedY * metersPerShapeUnit / 110_574];
  });
}
function densifyOutline(points: Point[], maxSegmentMeters = 260, maxPoints = 64): Point[] {
  if (points.length < 2 || points.length >= maxPoints) return points;
  const lengths = points.slice(1).map((point, index) => routeLength([points[index], point]));
  const divisions = lengths.map((length) => Math.max(1, Math.ceil(length / maxSegmentMeters)));
  while (divisions.reduce((sum, count) => sum + count, 0) + 1 > maxPoints) {
    let shortest = -1;
    let shortestPiece = Infinity;
    for (let index = 0; index < divisions.length; index++) {
      const piece = lengths[index] / divisions[index];
      if (divisions[index] > 1 && piece < shortestPiece) { shortest = index; shortestPiece = piece; }
    }
    if (shortest < 0) break;
    divisions[shortest]--;
  }
  const result = [points[0]];
  for (let index = 0; index < lengths.length; index++) {
    const start = points[index]; const end = points[index + 1];
    for (let step = 1; step <= divisions[index]; step++) {
      const progress = step / divisions[index];
      result.push([start[0] + (end[0] - start[0]) * progress, start[1] + (end[1] - start[1]) * progress]);
    }
  }
  return result;
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
function samplePolyline(points: Point[], count = 72): Point[] {
  if (points.length < 2) return points;
  const lengths = [0];
  for (let index = 1; index < points.length; index++) lengths.push(lengths[index - 1] + routeLength([points[index - 1], points[index]]));
  const total = lengths.at(-1) ?? 0;
  if (total === 0) return points;
  const samples: Point[] = [];
  let segment = 1;
  for (let index = 0; index < count; index++) {
    const target = total * index / (count - 1);
    while (segment < lengths.length - 1 && lengths[segment] < target) segment++;
    const startLength = lengths[segment - 1];
    const segmentLength = lengths[segment] - startLength;
    const progress = segmentLength === 0 ? 0 : (target - startLength) / segmentLength;
    const start = points[segment - 1]; const end = points[segment];
    samples.push([start[0] + (end[0] - start[0]) * progress, start[1] + (end[1] - start[1]) * progress]);
  }
  return samples;
}
function bounds(points: Point[]) {
  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);
  return { minLon: Math.min(...lons), maxLon: Math.max(...lons), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
}
function pointToSegmentDistance(point: Point, start: Point, end: Point, lonScale: number) {
  const px = point[0] * lonScale; const py = point[1];
  const startX = start[0] * lonScale; const startY = start[1];
  const endX = end[0] * lonScale; const endY = end[1];
  const dx = endX - startX; const dy = endY - startY;
  const denominator = dx * dx + dy * dy;
  const progress = denominator === 0 ? 0 : Math.max(0, Math.min(1, ((px - startX) * dx + (py - startY) * dy) / denominator));
  return Math.hypot(px - (startX + progress * dx), py - (startY + progress * dy));
}
function averageDistance(from: Point[], to: Point[], lonScale: number) {
  if (from.length === 0 || to.length < 2) return Infinity;
  return from.reduce((sum, point) => {
    let nearest = Infinity;
    for (let index = 1; index < to.length; index++) nearest = Math.min(nearest, pointToSegmentDistance(point, to[index - 1], to[index], lonScale));
    return sum + nearest;
  }, 0) / from.length;
}
function clamp(value: number) { return Math.max(0, Math.min(1, value)); }
function scoreRoute(outline: Point[], routed: Point[], actualDistance: number, targetDistance: number): number {
  if (outline.length < 2 || routed.length < 2) return 0;
  const sampledOutline = samplePolyline(outline);
  const sampledRoute = samplePolyline(routed);
  const centerLat = outline.reduce((sum, point) => sum + point[1], 0) / outline.length;
  const lonScale = Math.cos(centerLat * Math.PI / 180);
  const targetBounds = bounds(outline);
  const routeBounds = bounds(routed);
  const targetWidth = Math.max((targetBounds.maxLon - targetBounds.minLon) * lonScale, .000001);
  const targetHeight = Math.max(targetBounds.maxLat - targetBounds.minLat, .000001);
  const targetDiagonal = Math.hypot(targetWidth, targetHeight);
  const routeWidth = Math.max((routeBounds.maxLon - routeBounds.minLon) * lonScale, .000001);
  const routeHeight = Math.max(routeBounds.maxLat - routeBounds.minLat, .000001);
  const shapeError = (averageDistance(sampledRoute, sampledOutline, lonScale) + averageDistance(sampledOutline, sampledRoute, lonScale)) / 2 / targetDiagonal;
  const proportionError = Math.abs(Math.log((routeWidth / routeHeight) / (targetWidth / targetHeight)));
  const distanceError = Math.abs(actualDistance - targetDistance) / targetDistance;
  const targetIsLoop = Math.hypot((outline[0][0] - outline.at(-1)![0]) * lonScale, outline[0][1] - outline.at(-1)![1]) < targetDiagonal * .12;
  const closureError = targetIsLoop ? Math.hypot((routed[0][0] - routed.at(-1)![0]) * lonScale, routed[0][1] - routed.at(-1)![1]) / targetDiagonal : 0;
  const shapeFit = 1 - clamp(shapeError / .28);
  const proportionFit = 1 - clamp(proportionError / .7);
  const distanceFit = 1 - clamp(distanceError / .35);
  const closureFit = 1 - clamp(closureError / .3);
  return Math.round(100 * (.56 * shapeFit + .2 * proportionFit + .16 * distanceFit + .08 * closureFit));
}
function routeCandidates(shape: ResolvedShape, center: Point, distance: number, area?: SearchArea, distanceSamples = [distance]) {
  const offsets = [-.8, 0, .8];
  const scales = [.82, 1, 1.18];
  const rotations = [0, 45, 90, 135, 180, 225, 270, 315];
  const isGenericCat = shape.kind === "cat" && shape.label === art.cat.name;
  const variants = isGenericCat ? catVariants : [{ name: shape.label, points: shape.points }];
  const candidates: RouteCandidate[] = [];
  const sites = area
    ? Array.from({ length: 25 }, (_, index) => {
        const column = index % 5; const row = Math.floor(index / 5);
        return { center: [area.west + (area.east - area.west) * column / 4, area.south + (area.north - area.south) * row / 4] as Point, label: `area ${row + 1}-${column + 1}` };
      })
    : [{ center, label: "nearby" }];
  const addCandidate = (variant: { name: string; points: Point[] }, site: { center: Point; label: string }, transform: ShapeTransform, targetDistance = distance) => {
    const outline = densifyOutline(waypoints(shape.kind, site.center, targetDistance, transform, variant.points));
    if (area && !outline.every(([lon, lat]) => lon >= area.west && lon <= area.east && lat >= area.south && lat <= area.north)) return;
    candidates.push({ kind: shape.kind, shapeName: variant.name, variant: variant.name, targetDistance: targetDistance * 1000, outline, name: `${variant.name} · ${site.label} · ${transform.name}` });
  };
  if (distanceSamples.length > 1) {
    const rangeSites = area
      ? sites.filter((_, index) => Math.floor(index / 5) % 2 === 0 && index % 5 % 2 === 0).map((site) => ({ ...site, offsetX: 0, offsetY: 0 }))
      : offsets.flatMap((offsetY) => offsets.map((offsetX) => ({ center, label: `shift ${offsetX},${offsetY}`, offsetX, offsetY })));
    distanceSamples.forEach((targetDistance, distanceIndex) => {
      rangeSites.forEach((site, siteIndex) => {
        const variant = variants[(siteIndex + distanceIndex) % variants.length];
        for (const rotation of rotations) {
          addCandidate(variant, site, { name: `${site.label} · ${rotation}°`, scale: 1, rotation, offsetX: site.offsetX, offsetY: site.offsetY }, targetDistance);
        }
      });
    });
  } else if (area) {
    if (isGenericCat) {
      sites.forEach((site, index) => {
        const variant = variants[index % variants.length];
        for (const rotation of rotations) addCandidate(variant, site, { name: `${site.label} · ${rotation}°`, scale: 1, rotation });
      });
    } else {
      for (const site of sites) {
        for (const rotation of rotations) addCandidate(variants[0], site, { name: `${site.label} · ${rotation}°`, scale: 1, rotation });
      }
      for (const rotation of rotations) {
        for (const scale of [.82, 1.18]) addCandidate(variants[0], { center, label: "area center" }, { name: `area center · ${rotation}° · ${scale.toFixed(2)}×`, scale, rotation });
      }
    }
  } else if (isGenericCat) {
    const nearbyOffsets: Array<[number, number]> = [[.8, 0],[0,.8],[-.8,0],[0,-.8],[.8,.8],[.8,-.8],[-.8,.8],[-.8,-.8],[1.2,0],[0,1.2],[-1.2,0],[0,-1.2]];
    variants.forEach((variant, index) => {
      for (const rotation of rotations) {
        for (const scale of scales) {
          addCandidate(variant, { center, label: "nearby" }, { name: `center · ${rotation}° · ${scale.toFixed(2)}×`, scale, rotation });
        }
      }
      nearbyOffsets.forEach(([offsetX, offsetY], offsetIndex) => {
        const rotation = rotations[(offsetIndex + index) % rotations.length];
        addCandidate(variant, { center, label: "nearby" }, { name: `shift ${offsetX},${offsetY} · ${rotation}°`, scale: 1, rotation, offsetX, offsetY });
      });
    });
  } else {
    for (const rotation of rotations) {
      for (const scale of scales) {
        for (const offsetX of offsets) {
          for (const offsetY of offsets) {
            const offsetName = offsetX === 0 && offsetY === 0 ? "center" : `shift ${offsetX},${offsetY}`;
            addCandidate(variants[0], { center, label: "nearby" }, { name: `${offsetName} · ${rotation}° · ${scale.toFixed(2)}×`, scale, rotation, offsetX, offsetY });
          }
        }
      }
    }
  }
  const fallbackTransforms: ShapeTransform[] = [
    { name: "base", scale: 1 },
    { name: "compact", scale: .82 },
    { name: "roomier", scale: 1.18 },
    { name: "turned 45°", scale: 1, rotation: 45 },
    { name: "turned 90°", scale: 1, rotation: 90 },
    { name: "turned 135°", scale: 1, rotation: 135 },
    { name: "turned 180°", scale: 1, rotation: 180 },
    { name: "nearby streets", scale: 1, offsetX: .8, offsetY: -.8 },
  ];
  const fallbackCandidates: RouteCandidate[] = [];
  if (distanceSamples.length > 1) {
    if (isGenericCat) {
      distanceSamples.forEach((targetDistance, distanceIndex) => {
        for (let offset = 0; offset < 3; offset++) addFallback(variants[(distanceIndex * 3 + offset) % variants.length], { name: "base", scale: 1 }, targetDistance);
      });
    } else {
      for (const targetDistance of distanceSamples) addFallback(variants[0], { name: "base", scale: 1 }, targetDistance);
      const middleDistance = distanceSamples[Math.floor(distanceSamples.length / 2)];
      for (const transform of fallbackTransforms.slice(1, 7)) addFallback(variants[0], transform, middleDistance);
    }
  } else if (isGenericCat) {
    for (const variant of variants) addFallback(variant, { name: "base", scale: 1 });
    for (const transform of fallbackTransforms.slice(1, 3)) addFallback(variants[0], transform);
  } else {
    for (const transform of fallbackTransforms) addFallback(variants[0], transform);
  }
  function addFallback(variant: { name: string; points: Point[] }, transform: ShapeTransform, targetDistance = distance) {
    const outline = densifyOutline(waypoints(shape.kind, center, targetDistance, transform, variant.points));
    if (area && !outline.every(([lon, lat]) => lon >= area.west && lon <= area.east && lat >= area.south && lat <= area.north)) return;
    fallbackCandidates.push({ kind: shape.kind, shapeName: variant.name, variant: variant.name, targetDistance: targetDistance * 1000, outline, name: `${variant.name} · ${transform.name}` });
  }
  return { candidates: candidates.slice(0, MAX_CANDIDATES), fallbackCandidates };
}
function routeDiscoveryCandidates(center: Point, distanceSamples: number[], area?: SearchArea) {
  const rotations = [0, 45, 90, 135, 180, 225, 270, 315];
  const fractions = [.1, .3, .5, .7, .9];
  const sites = area
    ? fractions.flatMap((rowFraction, row) => fractions.map((columnFraction, column) => ({
        center: [area.west + (area.east - area.west) * columnFraction, area.south + (area.north - area.south) * rowFraction] as Point,
        label: `area ${row + 1}-${column + 1}`,
      })))
    : [{ center, label: "nearby" }];
  const posesPerLength = distanceSamples.length > 1 ? 3 : 9;
  const candidates: RouteCandidate[] = [];
  routeArtCatalog.forEach((shape, shapeIndex) => {
    distanceSamples.forEach((targetDistance, distanceIndex) => {
      for (let poseIndex = 0; poseIndex < posesPerLength; poseIndex++) {
        const siteIndex = area ? (shapeIndex * 11 + distanceIndex * 9 + poseIndex * 7) % sites.length : 0;
        const site = sites[siteIndex];
        const rotation = rotations[(shapeIndex + distanceIndex * 3 + poseIndex * (distanceSamples.length > 1 ? 3 : 1)) % rotations.length];
        const transform: ShapeTransform = { name: `${site.label} · ${rotation}°`, scale: 1, rotation };
        const outline = densifyOutline(waypoints(shape.kind, site.center, targetDistance, transform, shape.points));
        if (area && !outline.every(([lon, lat]) => lon >= area.west && lon <= area.east && lat >= area.south && lat <= area.north)) continue;
        candidates.push({
          kind: shape.kind,
          shapeName: shape.name,
          variant: shape.name,
          targetDistance: targetDistance * 1000,
          outline,
          name: `${shape.name} · ${site.label} · ${rotation}°`,
        });
      }
    });
  });
  const fallbackPool = new globalThis.Map<string, RouteCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.shapeName}:${candidate.targetDistance}`;
    if (!fallbackPool.has(key)) fallbackPool.set(key, candidate);
  }
  const fallbackCandidates = Array.from({ length: Math.min(9, routeArtCatalog.length * distanceSamples.length) }, (_, index) => {
    const shapeIndex = (index * 7) % routeArtCatalog.length;
    const distanceIndex = index % distanceSamples.length;
    const shape = routeArtCatalog[shapeIndex];
    return fallbackPool.get(`${shape.name}:${distanceSamples[distanceIndex] * 1000}`);
  }).filter((candidate): candidate is RouteCandidate => Boolean(candidate));
  return { candidates: candidates.slice(0, MAX_CANDIDATES), fallbackCandidates };
}
function distinctRouteOptions(routes: GeneratedRoute[], limit = 3) {
  const selected: GeneratedRoute[] = [];
  const isDistinct = (route: GeneratedRoute) => {
    const routeSamples = samplePolyline(route.coordinates, 36);
    const centerLat = route.coordinates.reduce((sum, [, lat]) => sum + lat, 0) / route.coordinates.length;
    const lonScale = Math.cos(centerLat * Math.PI / 180);
    return !selected.some((other) => {
      const otherSamples = samplePolyline(other.coordinates, 36);
      const averageSeparation = (averageDistance(routeSamples, otherSamples, lonScale) + averageDistance(otherSamples, routeSamples, lonScale)) * 55_287;
      return averageSeparation < Math.max(50, Math.min(100, Math.min(route.distance, other.distance) * .015));
    });
  };
  const selectedShapes = new Set<string>();
  const selectedTargets = new Set<number>();
  for (const route of routes) {
    if (selectedShapes.has(route.shapeName) || selectedTargets.has(route.target) || !isDistinct(route)) continue;
    selected.push(route);
    selectedShapes.add(route.shapeName);
    selectedTargets.add(route.target);
    if (selected.length === limit) break;
  }
  for (const route of routes) {
    if (selected.length === limit) break;
    if (!selected.includes(route) && !selectedTargets.has(route.target) && isDistinct(route)) {
      selected.push(route);
      selectedTargets.add(route.target);
    }
  }
  for (const route of routes) {
    if (selected.length === limit) break;
    if (!selected.includes(route) && !selectedShapes.has(route.shapeName) && isDistinct(route)) {
      selected.push(route);
      selectedShapes.add(route.shapeName);
    }
  }
  for (const route of routes) {
    if (selected.length === limit) break;
    if (!selected.includes(route) && isDistinct(route)) selected.push(route);
  }
  return selected;
}
function RouteOptionPreview({ route }: { route: GeneratedRoute }) {
  const all = [...route.coordinates, ...route.outline];
  const minLon = Math.min(...all.map(([lon]) => lon)); const maxLon = Math.max(...all.map(([lon]) => lon));
  const minLat = Math.min(...all.map(([, lat]) => lat)); const maxLat = Math.max(...all.map(([, lat]) => lat));
  const lonScale = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  const width = Math.max((maxLon - minLon) * lonScale, .000001); const height = Math.max(maxLat - minLat, .000001);
  const scale = Math.min(96 / width, 52 / height);
  const project = ([lon, lat]: Point) => [60 + ((lon - minLon) * lonScale - width / 2) * scale, 36 - ((lat - minLat) - height / 2) * scale];
  const path = (points: Point[]) => points.map((point) => project(point).map((coordinate) => coordinate.toFixed(1)).join(",")).join(" ");
  return <svg className="route-option-preview" viewBox="0 0 120 72" aria-hidden="true">
    <polyline points={path(route.outline)} className="route-option-target" />
    <polyline points={path(route.coordinates)} className="route-option-line" />
  </svg>;
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
function Map({ kind, center, points, outline, onPick, pickHint, interactive = false, onViewportChange }: { kind: Art; center: Point; points: Point[]; outline?: Point[]; onPick?: (center: Point) => void; pickHint?: string; interactive?: boolean; onViewportChange?: (bounds: MapBounds) => void }) {
  return <div className="map" aria-label={`${art[kind].name} route preview`}>
    <ArtPreview center={center} points={points} outline={outline} />
    <RouteMapCanvas center={center} points={points} outline={outline} onPick={onPick} interactive={interactive} onViewportChange={onViewportChange} />
    {outline?.length ? <div className="map-legend"><span className="legend-target" />Target art<span className="legend-route" />Walkable route</div> : null}
    {onPick ? <div className="map-pick-hint">{pickHint ?? "Drag or zoom to search this area · click to pin"}</div> : null}
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
  const [kind, setKind] = useState<Art>("abstract");
  const [location, setLocation] = useState("Jakarta, Indonesia");
  const [center, setCenter] = useState<Point>(defaultCenter);
  const [mapBounds, setMapBounds] = useState<SearchArea | null>(null);
  const [searchVisibleArea, setSearchVisibleArea] = useState(false);
  const [distance, setDistance] = useState(6);
  const [distanceRangeMode, setDistanceRangeMode] = useState(false);
  const [distanceMin, setDistanceMin] = useState(3);
  const [distanceMax, setDistanceMax] = useState(15);
  const [generated, setGenerated] = useState<GeneratedRoute | null>(null);
  const [generatedOptions, setGeneratedOptions] = useState<GeneratedRoute[]>([]);
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
  const shape = useMemo(() => idea.trim() ? resolveArtPrompt(idea) : discoveryShape(), [idea]);
  const previews = useMemo(() => waypoints(shape.kind, center, distance, { name: "preview", scale: 1 }, shape.points), [shape, center, distance]);
  const ready = generated !== null;
  const resultKind = generated?.kind ?? shape.kind;
  const resultArtName = generated?.shapeName ?? shape.label;
  const resultPoints = generated?.coordinates ?? previews;
  const resultLocation = generated?.location ?? location;
  const resultDistance = generated ? generated.distance / 1000 : distance;
  const resultOutline = generated?.outline;
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
    const autoDiscover = !idea.trim();
    const nextShape = autoDiscover ? discoveryShape() : resolveArtPrompt(idea);
    const activeArea = searchVisibleArea ? mapBounds : null;
    if (!activeArea && !location.trim()) return setError("Search for a place or choose a visible map area first.");
    setBusy(true); setError(""); setMessage(""); setGenerated(null); setGeneratedOptions([]);
    try {
      let nextCenter: Point;
      let nextLocation: string;
      if (activeArea) {
        nextCenter = [(activeArea.west + activeArea.east) / 2, (activeArea.south + activeArea.north) / 2];
        nextLocation = `Map area near ${nextCenter[1].toFixed(4)}, ${nextCenter[0].toFixed(4)}`;
      } else {
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
        nextCenter = place.center;
        nextLocation = place.location || trimmedLocation;
      }
      setCenter(nextCenter);
      if (!activeArea) setLocation(nextLocation);
      const targetMeters = distance * 1000;
      const distanceSamples = distanceRangeMode
        ? [...new Set([distanceMin, Math.round((distanceMin + distanceMax) / 2), distanceMax])]
        : [distance];
      const { candidates, fallbackCandidates } = autoDiscover
        ? routeDiscoveryCandidates(nextCenter, distanceSamples, activeArea ?? undefined)
        : routeCandidates(nextShape, nextCenter, distance, activeArea ?? undefined, distanceSamples);
      if (!candidates.length) {
        setError(distanceRangeMode ? "This map area is too small for the selected length range. Zoom out or narrow the range." : "This map area is too small for that route length. Zoom out or choose a shorter distance.");
        return;
      }
      let results: GeneratedRoute[] = [];
      let sawBusy = false;
      let usedStreetSearch = false;
      try {
        const response = await fetch("/api/route-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidates: candidates.map(({ name, outline, variant, targetDistance }) => ({ name, outline, variant, targetDistance })), targetDistance: targetMeters, area: activeArea ?? undefined, discoverShapes: autoDiscover }),
        });
        if (response.ok) {
          const payload = await response.json() as { routes?: Array<{ index: number; coordinates: Point[]; distance: number; quality: number }> };
          results = (payload.routes ?? []).flatMap((route) => {
            const candidate = candidates[route.index];
            if (!candidate || !route.coordinates?.length) return [];
            return [{ coordinates: route.coordinates, distance: route.distance, kind: candidate.kind, shapeName: candidate.shapeName, prompt: idea.trim(), location: nextLocation, target: candidate.targetDistance / 1000, outline: candidate.outline, quality: Math.min(route.quality, scoreRoute(candidate.outline, route.coordinates, route.distance, candidate.targetDistance)), candidateName: `${candidate.name} · street search` }];
          });
          usedStreetSearch = results.length > 0;
        }
      } catch {
        // Fall back to the configured directions service when map graph search is unreachable.
      }
      if (!usedStreetSearch) {
        for (let index = 0; index < fallbackCandidates.length; index += 2) {
          const batch = await Promise.all(fallbackCandidates.slice(index, index + 2).map(async (candidate): Promise<GeneratedRoute | { error: "busy" | "directions" }> => {
            try {
              const waypoints = candidate.outline.length > 25 ? samplePolyline(candidate.outline, 25) : candidate.outline;
              const direction = await fetch("/api/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coordinates: waypoints }) });
              if (!direction.ok) return { error: direction.status === 429 ? "busy" as const : "directions" as const };
              const payload = await direction.json() as { coordinates?: Point[]; distance?: number; duration?: number };
              if (!payload.coordinates?.length) return { error: "directions" as const };
              if (activeArea && payload.coordinates.some(([lon, lat]) => lon < activeArea.west || lon > activeArea.east || lat < activeArea.south || lat > activeArea.north)) return { error: "directions" as const };
              const actual = typeof payload.distance === "number" && payload.distance > 0 ? payload.distance : routeLength(payload.coordinates);
              return { coordinates: payload.coordinates, distance: actual, duration: payload.duration, kind: candidate.kind, shapeName: candidate.shapeName, prompt: idea.trim(), location: nextLocation, target: candidate.targetDistance / 1000, outline: candidate.outline, quality: scoreRoute(candidate.outline, payload.coordinates, actual, candidate.targetDistance), candidateName: `${candidate.name} · directions fallback` };
            } catch {
              return { error: "directions" as const };
            }
          }));
          sawBusy ||= batch.some((result) => "error" in result && result.error === "busy");
          results.push(...batch.filter((result): result is GeneratedRoute => !("error" in result)));
        }
      }
      const ordered = results.sort((left, right) => right.quality - left.quality || (distanceRangeMode ? 0 : Math.abs(left.distance - targetMeters) - Math.abs(right.distance - targetMeters)));
      if (!ordered.length) throw new Error(sawBusy ? "busy" : "empty");
      const options = distinctRouteOptions(ordered.filter((route) => route.quality >= MIN_ROUTE_QUALITY));
      if (!options.length) {
        setError(autoDiscover
          ? `We checked the local shape library, but no route matched cleanly here. Try another area or ${distanceRangeMode ? "a wider length range" : "a different distance"}.`
          : `We found streets, but none make a clean enough ${nextShape.label.toLowerCase()} here. Try another nearby area, ${distanceRangeMode ? "a wider length range" : "a different distance"}, or a simpler outline.`);
        return;
      }
      const best = options[0];
      setKind(best.kind); setGeneratedOptions(options); setGenerated(best);
      const actualKm = best.distance / 1000;
      const abstractNote = nextShape.isAbstract ? " This prompt wasn’t in the local shape guide, so this is an abstract interpretation." : "";
      const distanceDescription = distanceRangeMode ? `within your ${distanceMin}–${distanceMax} km range` : `for your ${distance} km target`;
      const discoveryNote = autoDiscover ? ` · best shape ${best.shapeName}` : "";
      setMessage(`${options.length} route option${options.length === 1 ? "" : "s"} found${discoveryNote} · best fit ${best.quality}% · ${actualKm.toFixed(1)} km ${distanceDescription}.${abstractNote} Choose an option below and review it before you go.`);
      document.getElementById("routes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (cause) { setError(cause instanceof Error && cause.message === "busy" ? "Street routing is busy right now. Wait a few seconds and try again." : `We couldn’t build a walkable route there. Try a denser area, ${distanceRangeMode ? "a wider length range" : "a shorter distance"}${autoDiscover ? "." : ", or another art prompt."}`); } finally { setBusy(false); }
  }
  const changeIdea = (value: string) => {
    setIdea(value);
    setError("");
    setKind(value.trim() ? resolveArtPrompt(value).kind : "abstract");
    setGenerated(null);
    setGeneratedOptions([]);
    setMessage("");
  };
  const changeLocation = (value: string) => {
    setLocation(value);
    setSelectedPlace(null);
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSearching(false);
    setGenerated(null);
    setGeneratedOptions([]);
    setSearchVisibleArea(false);
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
    setGeneratedOptions([]);
    setSearchVisibleArea(false);
    setMessage("");
    setError("");
  };
  const pickOnMap = async (picked: Point) => {
    if (busy) return;
    const request = ++pickRequest.current;
    const fallback = `Selected area (${picked[1].toFixed(4)}, ${picked[0].toFixed(4)})`;
    setCenter(picked);
    setGenerated(null);
    setGeneratedOptions([]);
    setSearchVisibleArea(false);
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
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark">S</span><span>RouteBuddy</span></a>
        <nav><a href="#how">How it works</a><a href="#routes">Your route</a></nav>
      </header>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker"><span className="pulse" /> STREET-LEVEL ROUTE ART</p>
          <h1>Search a place.<br /><em>Make your mark.</em></h1>
          <p className="lede">Turn an art prompt into a walkable route on a real map. Search a place or explore an area, then compare and export the results.</p>
          <div className="hero-notes"><span>Live place search</span><span>Area-wide options</span><span>GPX export</span></div>
        </div>
        <div className="hero-map">
          <Map kind={kind} center={center} points={previews} onPick={pickOnMap} interactive onViewportChange={setMapBounds} pickHint={picking ? "Finding the nearest place…" : "Drag or zoom to search this area · click to pin"} />
        </div>
      </section>
      <section className="studio">
        <div className="studio-heading">
          <div><p className="section-label">01 / SEARCH & DRAW</p><h2>What do you want<br />to draw today?</h2></div>
          <p>Describe an object or combine two ideas, choose a place or map area, and compare the best street matches.</p>
        </div>
        <form className="creator-grid" onSubmit={submit} noValidate>
          <div className="idea-panel">
            <label htmlFor="idea">Art prompt</label>
            <div className="idea-field">
              <input id="idea" value={idea} onChange={(event) => changeIdea(event.target.value)} aria-invalid={Boolean(error)} placeholder="Leave blank to find the best shape…" />
              <button type="submit" aria-label="Generate routes" disabled={busy}>↗</button>
            </div>
            <p className="idea-hint">Leave blank to compare all {routeArtCatalog.length} built-in silhouettes for the best street match.</p>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <div className="quick-picks">
              <span>Quick picks</span>
              {(Object.keys(art).filter((item) => item !== "abstract") as Art[]).map((item) => <button type="button" className={kind === item ? "picked" : ""} onClick={() => { setKind(item); setIdea(art[item].name); setGenerated(null); setGeneratedOptions([]); setError(""); setMessage(""); }} key={item}>{art[item].name}</button>)}
            </div>
          </div>
          <div className="settings-panel">
            <div className="setting-title"><label htmlFor={distanceRangeMode ? "distance-min" : "distance"}>{distanceRangeMode ? "Length range" : "Target distance"}</label><strong>{distanceRangeMode ? `${distanceMin}–${distanceMax} km` : `${distance}.0 km`}</strong></div>
            {distanceRangeMode ? <div className="distance-range-controls">
              <label htmlFor="distance-min">From {distanceMin} km<input className="distance-range-slider" id="distance-min" type="range" min="3" max={distanceMax - 1} value={distanceMin} onChange={(event) => { setDistanceMin(Number(event.target.value)); setGenerated(null); setGeneratedOptions([]); setMessage(""); setError(""); }} /></label>
              <label htmlFor="distance-max">To {distanceMax} km<input className="distance-range-slider" id="distance-max" type="range" min={distanceMin + 1} max="15" value={distanceMax} onChange={(event) => { setDistanceMax(Number(event.target.value)); setGenerated(null); setGeneratedOptions([]); setMessage(""); setError(""); }} /></label>
            </div> : <>
              <input className="distance" id="distance" type="range" min="3" max="15" value={distance} onChange={(event) => { setDistance(Number(event.target.value)); setGenerated(null); setGeneratedOptions([]); setMessage(""); }} />
              <div className="range-labels"><span>3 km</span><span>15 km</span></div>
            </>}
            <label className="distance-range-toggle"><input type="checkbox" checked={distanceRangeMode} onChange={(event) => { setDistanceRangeMode(event.target.checked); setGenerated(null); setGeneratedOptions([]); setMessage(""); setError(""); }} />Let the map choose the best length</label>
            {distanceRangeMode ? <p className="distance-range-help">Compare routes at the low, middle, and high ends of this range.</p> : null}
            <div className="location">
              <span className="pin">◎</span>
              <div className="location-field">
                <label htmlFor="location">PLACE SEARCH (OPTIONAL FOR AREA SEARCH)</label>
                <input id="location" value={location} onChange={(event) => changeLocation(event.target.value)} onFocus={onLocationFocus} onBlur={onLocationBlur} onKeyDown={onLocationKeyDown} placeholder="City, address, or landmark" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={Boolean(canSuggest && (searching || suggestions.length > 0))} aria-controls="location-suggestions" aria-activedescendant={canSuggest && activeSuggestion >= 0 ? `location-suggestion-${activeSuggestion}` : undefined} />
                {selectedPlace && !picking ? <p className="place-confirmed">✓ Selected: {selectedPlace.location}</p> : null}
                {picking ? <p className="place-confirmed">Finding the nearest place…</p> : null}
                {canSuggest && (searching || suggestions.length > 0) ? <div className="suggestions" id="location-suggestions">
                  {searching ? <p className="suggestion-note" aria-live="polite">Searching…</p> : null}
                  <ul role="listbox" aria-label="Place suggestions">{suggestions.map((place, index) => <li id={`location-suggestion-${index}`} key={`${place.location}-${place.center.join(",")}`} role="option" aria-selected={index === activeSuggestion} className={index === activeSuggestion ? "suggestion active" : "suggestion"} onPointerDown={(event) => event.preventDefault()} onClick={() => selectPlace(place)} onMouseEnter={() => setActiveSuggestion(index)}><span className="suggestion-pin" aria-hidden="true">◎</span><span>{place.location}</span></li>)}</ul>
                </div> : null}
              </div>
            </div>
            <div className="area-search-control">
              <button type="button" className={searchVisibleArea ? "area-toggle selected" : "area-toggle"} disabled={!mapBounds || busy} aria-pressed={searchVisibleArea} onClick={() => { setSearchVisibleArea((active) => !active); setGenerated(null); setGeneratedOptions([]); setMessage(""); setError(""); }}>
                {searchVisibleArea ? "Using visible map area ✓" : "Search the visible map area"}
              </button>
              <p>{searchVisibleArea ? "Pan or zoom the map above to adjust the search area." : "Drag or zoom the map above, then search its visible area without a place name."}</p>
            </div>
            <button className="primary" type="submit" disabled={busy}>{busy ? distanceRangeMode ? "Searching route lengths…" : "Searching the map area…" : ready ? "Find more route options" : "Find route options"}<span>→</span></button>
            <p className="token-note">We compare {distanceRangeMode ? "route lengths plus " : ""}rotated placements with walkable streets and show up to three distinct routes.</p>
          </div>
        </form>
      </section>
      <section className="result" id="routes">
        <div className="result-top">
          <div><p className="section-label">02 / YOUR ROUTES</p><h2>{ready ? generatedOptions.length > 1 ? "Choose your favorite." : "Best match found." : "Ready when you are."}</h2></div>
          <p>{ready ? `${generatedOptions.length} street-matched option${generatedOptions.length === 1 ? "" : "s"} near ${resultLocation}.` : "Choose a place or visible map area to compare clean route-art options."}</p>
        </div>
        {message ? <p className="action-message" role="status">{message}</p> : null}
        {ready ? <div className="route-options" role="group" aria-label="Generated route options">
          {generatedOptions.map((option, index) => <button type="button" className={generated === option ? "route-option active" : "route-option"} aria-pressed={generated === option} onClick={() => setGenerated(option)} key={`${option.candidateName}-${index}`}>
            <RouteOptionPreview route={option} />
            <span className="route-option-copy"><strong>{option.shapeName}</strong><small>Option {index + 1} · {option.quality}% fit · {(option.distance / 1000).toFixed(1)} km</small></span>
          </button>)}
        </div> : null}
        <div className="route-result">
          <div className="result-map"><Map kind={resultKind} center={center} points={resultPoints} outline={resultOutline} /></div>
          <div className="route-details">
            <span className="status"><i /> {ready ? "ROUTE READY" : "WAITING FOR YOUR SEARCH"}</span>
            <h3>{resultArtName}</h3>
            <div className="metrics">
              <div><strong>{resultDistance.toFixed(1)} <small>km</small></strong><span>{ready ? "Actual" : "Target"}</span></div>
              <div><strong>{ready ? `${generated.quality}%` : "--"}</strong><span>Shape fit</span></div>
              <div><strong>{ready ? resultPoints.length : "--"}<small> pts</small></strong><span>Street points</span></div>
            </div>
            <div className="route-tip"><b>◌</b><p><strong>Always review before heading out</strong><br />Routes follow public street data and can change. Inspect the selected route before starting.</p></div>
            <button className="download" disabled={!ready} onClick={() => { downloadGpx(resultArtName, resultPoints, resultDistance, resultLocation); setMessage("GPX downloaded. Review it in your navigation app before starting."); }}>Download GPX <span>↓</span></button>
          </div>
        </div>
      </section>
      <section className="steps" id="how"><p className="section-label">HOW IT WORKS</p><div><h2>Less planning.<br />More stories.</h2><ol><li><span>01</span><p><b>Choose an area</b>Search a place name or pan and zoom the map.</p></li><li><span>02</span><p><b>Describe your art</b>Pick a route-art shape and set a target distance.</p></li><li><span>03</span><p><b>Compare and review</b>Choose a route option, export GPX, and validate it in your navigation app.</p></li></ol></div></section>
      <footer><a className="brand" href="#top"><span className="brand-mark">S</span><span>RouteBuddy</span></a><p>Routes that look like something.</p><span>© 2026 RouteBuddy</span></footer>
    </main>
  );
}
