type Point = [number, number];
type Candidate = { name: string; variant?: string; targetDistance: number; outline: Point[] };
type SearchArea = { south: number; west: number; north: number; east: number };
type OSMNode = { type: "node"; id: number; lat: number; lon: number };
type OSMWay = { type: "way"; id: number; nodes: number[]; tags?: Record<string, string> };
type OSMElement = OSMNode | OSMWay;
type OSMResponse = { elements?: OSMElement[] };
type Edge = { to: number; key: string; meters: number; weight: number };
type Graph = { nodes: Map<number, Point>; edges: Map<number, Edge[]>; grid: Map<string, number[]>; referenceLatitude: number };
type Previous = { node: number; edge: Edge };
type SearchTree = { weights: Map<number, number>; meters: Map<number, number>; previous: Map<number, Previous> };
type BeamState = { start: number; last: number; nodes: number[]; edgeKeys: Set<string>; meters: number; score: number };
type PreparedCandidate = { candidate: Candidate; anchors: Array<Array<{ id: number; point: Point; miss: number }>>; score: number; center: Point };

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const MAX_CANDIDATES = 217;
const MAX_ANCHORS = 64;
const MAX_SEARCH_CANDIDATES = 10;
const MAX_DISCOVERY_SEARCH_CANDIDATES = 22;
const BEAM_WIDTH = 20;
const SNAP_LIMIT_METERS = 350;
const GRID_CELL_METERS = 100;
const MAX_CACHED_GRAPHS = 8;
const MAX_CACHED_SEARCH_TREES = 16;
const graphCache = new Map<string, { expires: number; graph: Graph }>();
const graphPending = new Map<string, Promise<Graph>>();

function validPoint(value: unknown): value is Point {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number" && Number.isFinite(item)) && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
}

function validArea(value: unknown): value is SearchArea {
  if (!value || typeof value !== "object") return false;
  const area = value as Record<string, unknown>;
  return typeof area.west === "number" && Number.isFinite(area.west) && area.west >= -180 && area.west <= 180
    && typeof area.east === "number" && Number.isFinite(area.east) && area.east >= -180 && area.east <= 180 && area.east > area.west
    && typeof area.south === "number" && Number.isFinite(area.south) && area.south >= -90 && area.south <= 90
    && typeof area.north === "number" && Number.isFinite(area.north) && area.north >= -90 && area.north <= 90 && area.north > area.south;
}

function insideArea(point: Point, area: SearchArea) {
  return point[0] >= area.west && point[0] <= area.east && point[1] >= area.south && point[1] <= area.north;
}

function distanceMeters(a: Point, b: Point) {
  const lat = (a[1] + b[1]) / 2 * Math.PI / 180;
  const x = (b[0] - a[0]) * Math.cos(lat) * 111_320;
  const y = (b[1] - a[1]) * 110_574;
  return Math.hypot(x, y);
}

function routeLength(points: Point[]) {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += distanceMeters(points[i - 1], points[i]);
  return length;
}

function gridCoordinates(point: Point, referenceLatitude: number) {
  const x = point[0] * Math.cos(referenceLatitude * Math.PI / 180) * 111_320;
  const y = point[1] * 110_574;
  return [Math.floor(x / GRID_CELL_METERS), Math.floor(y / GRID_CELL_METERS)] as const;
}

function gridKey(x: number, y: number) { return `${x}:${y}`; }

function graphBounds(candidates: Candidate[], area?: SearchArea) {
  const all = candidates.flatMap((candidate) => candidate.outline);
  const minLon = area?.west ?? Math.min(...all.map(([lon]) => lon));
  const maxLon = area?.east ?? Math.max(...all.map(([lon]) => lon));
  const minLat = area?.south ?? Math.min(...all.map(([, lat]) => lat));
  const maxLat = area?.north ?? Math.max(...all.map(([, lat]) => lat));
  const middleLat = (minLat + maxLat) / 2;
  const marginLat = .0027;
  const marginLon = marginLat / Math.max(.15, Math.cos(middleLat * Math.PI / 180));
  return {
    south: Math.max(-90, minLat - marginLat),
    west: Math.max(-180, minLon - marginLon),
    north: Math.min(90, maxLat + marginLat),
    east: Math.min(180, maxLon + marginLon),
  };
}

function cacheBounds(bounds: ReturnType<typeof graphBounds>) {
  return {
    south: Math.floor(bounds.south * 100) / 100,
    west: Math.floor(bounds.west * 100) / 100,
    north: Math.ceil(bounds.north * 100) / 100,
    east: Math.ceil(bounds.east * 100) / 100,
  };
}

function cacheKey(bounds: ReturnType<typeof cacheBounds>) {
  return `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
}

function roadWeight(highway: string, meters: number) {
  const factors: Record<string, number> = {
    footway: .82, pedestrian: .82, path: .88, cycleway: .9, living_street: .92,
    residential: 1, unclassified: 1.04, service: 1.08, track: 1.1, tertiary: 1.16,
    secondary: 1.36, primary: 1.72, trunk: 2.1, steps: 1.34,
  };
  return meters * (factors[highway] ?? 1.12);
}

function allowedWay(tags: Record<string, string> | undefined) {
  const highway = tags?.highway;
  if (!highway || ["construction", "proposed", "raceway", "motorway", "motorway_link"].includes(highway)) return false;
  if (tags.motorroad === "yes") return false;
  const foot = tags.foot?.toLowerCase();
  if (foot === "no" || foot === "private") return false;
  const access = tags.access?.toLowerCase();
  if ((access === "no" || access === "private") && !["yes", "designated", "permissive"].includes(foot ?? "")) return false;
  return true;
}

function buildGraph(elements: OSMElement[]): Graph {
  const nodes = new Map<number, Point>();
  const ways: OSMWay[] = [];
  for (const element of elements) {
    if (element.type === "node" && Number.isFinite(element.lat) && Number.isFinite(element.lon)) nodes.set(element.id, [element.lon, element.lat]);
    else if (element.type === "way") ways.push(element);
  }
  const edges = new Map<number, Edge[]>();
  const addEdge = (from: number, edge: Edge) => {
    const outgoing = edges.get(from) ?? [];
    outgoing.push(edge);
    edges.set(from, outgoing);
  };
  for (const way of ways) {
    if (!allowedWay(way.tags)) continue;
    const highway = way.tags?.highway ?? "residential";
    for (let i = 1; i < (way.nodes?.length ?? 0); i++) {
      const from = way.nodes[i - 1]; const to = way.nodes[i];
      const a = nodes.get(from); const b = nodes.get(to);
      if (!a || !b || from === to) continue;
      const meters = distanceMeters(a, b);
      if (!Number.isFinite(meters) || meters <= 0 || meters > 2_000) continue;
      const key = `${way.id}:${Math.min(from, to)}:${Math.max(from, to)}`;
      const weight = roadWeight(highway, meters);
      addEdge(from, { to, key, meters, weight });
      addEdge(to, { to: from, key, meters, weight });
    }
  }
  const referenceLatitude = nodes.size ? [...nodes.values()].reduce((sum, point) => sum + point[1], 0) / nodes.size : 0;
  const grid = new Map<string, number[]>();
  for (const [id, point] of nodes) {
    if (!edges.has(id)) continue;
    const [x, y] = gridCoordinates(point, referenceLatitude);
    const key = gridKey(x, y);
    const cell = grid.get(key) ?? [];
    cell.push(id);
    grid.set(key, cell);
  }
  return { nodes, edges, grid, referenceLatitude };
}

async function loadGraph(candidates: Candidate[], area?: SearchArea): Promise<Graph> {
  const bounds = cacheBounds(graphBounds(candidates, area));
  const key = cacheKey(bounds);
  const cached = graphCache.get(key);
  if (cached && cached.expires > Date.now()) {
    graphCache.delete(key);
    graphCache.set(key, cached);
    return cached.graph;
  }
  const pending = graphPending.get(key);
  if (pending) return pending;
  const boundsArea = (bounds.north - bounds.south) * (bounds.east - bounds.west);
  if (boundsArea > .12) throw new Error("area-too-large");
  const query = `[out:json][timeout:20];(way["highway"](${bounds.south},${bounds.west},${bounds.north},${bounds.east}););out body;>;out skel qt;`;
  const request = (async () => {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error("map-data-unavailable");
    const data = await response.json() as OSMResponse;
    const graph = buildGraph(data.elements ?? []);
    if (graph.edges.size < 2) throw new Error("no-walkable-streets");
    graphCache.set(key, { graph, expires: Date.now() + 30 * 60 * 1000 });
    while (graphCache.size > MAX_CACHED_GRAPHS) graphCache.delete(graphCache.keys().next().value!);
    return graph;
  })();
  graphPending.set(key, request);
  try { return await request; } finally { graphPending.delete(key); }
}

class MinHeap {
  private values: Array<{ node: number; weight: number }> = [];
  push(value: { node: number; weight: number }) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].weight <= value.weight) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }
  pop() {
    if (!this.values.length) return undefined;
    const first = this.values[0];
    const last = this.values.pop()!;
    if (this.values.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1; const right = left + 1;
        if (left >= this.values.length) break;
        const child = right < this.values.length && this.values[right].weight < this.values[left].weight ? right : left;
        if (this.values[child].weight >= last.weight) break;
        this.values[index] = this.values[child];
        index = child;
      }
      this.values[index] = last;
    }
    return first;
  }
}

function dijkstra(graph: Graph, source: number): SearchTree {
  const weights = new Map<number, number>([[source, 0]]);
  const meters = new Map<number, number>([[source, 0]]);
  const previous = new Map<number, Previous>();
  const queue = new MinHeap();
  queue.push({ node: source, weight: 0 });
  while (true) {
    const current = queue.pop();
    if (!current) break;
    if (current.weight !== weights.get(current.node)) continue;
    for (const edge of graph.edges.get(current.node) ?? []) {
      const nextWeight = current.weight + edge.weight;
      if (nextWeight >= (weights.get(edge.to) ?? Infinity)) continue;
      weights.set(edge.to, nextWeight);
      meters.set(edge.to, (meters.get(current.node) ?? 0) + edge.meters);
      previous.set(edge.to, { node: current.node, edge });
      queue.push({ node: edge.to, weight: nextWeight });
    }
  }
  return { weights, meters, previous };
}

function getSearchTree(graph: Graph, cache: Map<number, SearchTree>, source: number) {
  const cached = cache.get(source);
  if (cached) {
    cache.delete(source);
    cache.set(source, cached);
    return cached;
  }
  const tree = dijkstra(graph, source);
  cache.set(source, tree);
  while (cache.size > MAX_CACHED_SEARCH_TREES) cache.delete(cache.keys().next().value!);
  return tree;
}

function pathTo(tree: SearchTree, source: number, destination: number) {
  if (!tree.weights.has(destination)) return null;
  const nodes = [destination];
  const edges: Edge[] = [];
  let node = destination;
  while (node !== source) {
    const previous = tree.previous.get(node);
    if (!previous) return null;
    edges.push(previous.edge);
    node = previous.node;
    nodes.push(node);
    if (nodes.length > tree.previous.size + 1) return null;
  }
  nodes.reverse();
  edges.reverse();
  return { nodes, edges, meters: tree.meters.get(destination) ?? 0 };
}

function nearestNodes(graph: Graph, target: Point, area?: SearchArea) {
  const nearest: Array<{ id: number; point: Point; miss: number }> = [];
  const [centerX, centerY] = gridCoordinates(target, graph.referenceLatitude);
  const radius = Math.ceil(SNAP_LIMIT_METERS / GRID_CELL_METERS) + 1;
  for (let x = centerX - radius; x <= centerX + radius; x++) {
    for (let y = centerY - radius; y <= centerY + radius; y++) {
      for (const id of graph.grid.get(gridKey(x, y)) ?? []) {
        const point = graph.nodes.get(id);
        if (!point) continue;
        if (area && !insideArea(point, area)) continue;
        const miss = distanceMeters(target, point);
        if (miss > SNAP_LIMIT_METERS) continue;
        let position = nearest.findIndex((item) => miss < item.miss);
        if (position < 0) position = nearest.length;
        nearest.splice(position, 0, { id, point, miss });
        if (nearest.length > 4) nearest.pop();
      }
    }
  }
  return nearest;
}

function pointToSegment(point: Point, start: Point, end: Point, latitude: number) {
  const lonScale = Math.cos(latitude * Math.PI / 180);
  const px = point[0] * lonScale; const py = point[1];
  const sx = start[0] * lonScale; const sy = start[1];
  const ex = end[0] * lonScale; const ey = end[1];
  const dx = ex - sx; const dy = ey - sy;
  const denominator = dx * dx + dy * dy;
  const fraction = denominator ? Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / denominator)) : 0;
  return Math.hypot(px - (sx + fraction * dx), py - (sy + fraction * dy)) * 110_574;
}

function averageDistance(points: Point[], path: Point[], latitude: number) {
  if (path.length < 2) return Infinity;
  return points.reduce((sum, point) => {
    let nearest = Infinity;
    for (let i = 1; i < path.length; i++) nearest = Math.min(nearest, pointToSegment(point, path[i - 1], path[i], latitude));
    return sum + nearest;
  }, 0) / points.length;
}

function routeScore(outline: Point[], path: Point[], actualMeters: number, targetMeters: number, repeatedMeters: number) {
  const middleLat = outline.reduce((sum, point) => sum + point[1], 0) / outline.length;
  const minLon = Math.min(...outline.map(([lon]) => lon)); const maxLon = Math.max(...outline.map(([lon]) => lon));
  const minLat = Math.min(...outline.map(([, lat]) => lat)); const maxLat = Math.max(...outline.map(([, lat]) => lat));
  const width = Math.max((maxLon - minLon) * Math.cos(middleLat * Math.PI / 180) * 111_320, .1);
  const height = Math.max((maxLat - minLat) * 110_574, .1);
  const diagonal = Math.hypot(width, height);
  const routeWidth = Math.max((Math.max(...path.map(([lon]) => lon)) - Math.min(...path.map(([lon]) => lon))) * Math.cos(middleLat * Math.PI / 180) * 111_320, .1);
  const routeHeight = Math.max((Math.max(...path.map(([, lat]) => lat)) - Math.min(...path.map(([, lat]) => lat))) * 110_574, .1);
  const shapeError = (averageDistance(path, outline, middleLat) + averageDistance(outline, path, middleLat)) / 2 / diagonal;
  const proportions = Math.abs(Math.log((routeWidth / routeHeight) / (width / height)));
  const distanceError = Math.abs(actualMeters - targetMeters) / targetMeters;
  const repeatRatio = repeatedMeters / Math.max(actualMeters, 1);
  const targetIsLoop = distanceMeters(outline[0], outline.at(-1)!) < diagonal * .12;
  const closureError = targetIsLoop ? distanceMeters(path[0], path.at(-1)!) / diagonal : 0;
  const closeness = 1 - Math.min(1, shapeError / .28);
  const proportionFit = 1 - Math.min(1, proportions / .7);
  const distanceFit = 1 - Math.min(1, distanceError / .35);
  const closureFit = 1 - Math.min(1, closureError / .3);
  return Math.max(0, Math.round(100 * (.58 * closeness + .18 * proportionFit + .14 * distanceFit + .1 * closureFit) - Math.min(30, repeatRatio * 100)));
}

function prepareCandidate(graph: Graph, candidate: Candidate, targetMeters: number, area?: SearchArea): PreparedCandidate | null {
  const anchors = candidate.outline.map((point) => nearestNodes(graph, point, area));
  if (anchors.some((items) => !items.length)) return null;
  const diagonal = Math.max(routeLength([candidate.outline[0], candidate.outline[Math.floor(candidate.outline.length / 2)]]), 300);
  const snapError = anchors.reduce((sum, items) => sum + items[0].miss, 0) / anchors.length / diagonal;
  const distanceError = Math.abs(Math.log(Math.max(routeLength(candidate.outline), 1) / targetMeters));
  const minLon = Math.min(...candidate.outline.map(([lon]) => lon)); const maxLon = Math.max(...candidate.outline.map(([lon]) => lon));
  const minLat = Math.min(...candidate.outline.map(([, lat]) => lat)); const maxLat = Math.max(...candidate.outline.map(([, lat]) => lat));
  return { candidate, anchors, score: snapError + distanceError * .12, center: [(minLon + maxLon) / 2, (minLat + maxLat) / 2] };
}

function searchCandidate(graph: Graph, outline: Point[], anchors: PreparedCandidate["anchors"], targetMeters: number, trees: Map<number, SearchTree>, area?: SearchArea) {
  const diagonal = Math.max(routeLength([outline[0], outline[Math.floor(outline.length / 2)]]), 300);
  const firstAnchorIds = new Set(anchors[0].map((item) => item.id));
  let beam: BeamState[] = anchors[0].map((item) => ({ start: item.id, last: item.id, nodes: [item.id], edgeKeys: new Set(), meters: 0, score: item.miss / diagonal }));
  const targetIsLoop = distanceMeters(outline[0], outline.at(-1)!) < diagonal * .12;
  for (let anchorIndex = 1; anchorIndex < anchors.length; anchorIndex++) {
    const next: BeamState[] = [];
    const progress = anchorIndex / (anchors.length - 1);
    const direct = distanceMeters(outline[anchorIndex - 1], outline[anchorIndex]);
    for (const state of beam) {
      const tree = getSearchTree(graph, trees, state.last);
      for (const target of anchors[anchorIndex]) {
        if (targetIsLoop && anchorIndex === anchors.length - 1 && target.id !== state.start) continue;
        const leg = pathTo(tree, state.last, target.id);
        if (!leg) continue;
        let repeated = 0;
        for (const edge of leg.edges) if (state.edgeKeys.has(edge.key)) repeated += edge.meters;
        const edgeKeys = new Set(state.edgeKeys);
        for (const edge of leg.edges) edgeKeys.add(edge.key);
        const meters = state.meters + leg.meters;
        const detour = Math.max(0, leg.meters - direct);
        const expectedMeters = targetMeters * progress;
        const distanceBalance = Math.abs(meters - expectedMeters) / targetMeters;
        const nodes = state.nodes.concat(leg.nodes.slice(1));
        next.push({
          start: state.start,
          last: target.id,
          nodes,
          edgeKeys,
          meters,
          score: state.score + target.miss / diagonal * 1.35 + detour / diagonal * .16 + repeated / targetMeters * 2 + distanceBalance * .12,
        });
      }
    }
    if (!next.length) return null;
    const byEnd = new Map<string, BeamState[]>();
    const perStartLimit = Math.max(2, Math.ceil(BEAM_WIDTH / Math.max(firstAnchorIds.size, 1)));
    for (const state of next.sort((a, b) => a.score - b.score)) {
      const key = `${state.start}:${state.last}`;
      const states = byEnd.get(key) ?? [];
      if (states.length < 2) { states.push(state); byEnd.set(key, states); }
    }
    const byStart = new Map<number, BeamState[]>();
    for (const state of [...byEnd.values()].flat().sort((a, b) => a.score - b.score)) {
      const states = byStart.get(state.start) ?? [];
      if (states.length < perStartLimit) { states.push(state); byStart.set(state.start, states); }
    }
    beam = [...byStart.values()].flat().sort((a, b) => a.score - b.score).slice(0, BEAM_WIDTH);
  }
  let best: { coordinates: Point[]; distance: number; quality: number; edgeKeys: string[] } | null = null;
  for (const state of beam) {
    const coordinates = state.nodes.flatMap((node) => {
      const point = graph.nodes.get(node);
      return point ? [point] : [];
    });
    if (coordinates.length < 2) continue;
    if (area && coordinates.some((point) => !insideArea(point, area))) continue;
    let repeatedMeters = 0;
    const used = new Set<string>();
    const edgeKeys: string[] = [];
    for (let i = 1; i < state.nodes.length; i++) {
      const from = state.nodes[i - 1]; const to = state.nodes[i];
      const edge = (graph.edges.get(from) ?? []).find((item) => item.to === to);
      if (!edge) continue;
      if (used.has(edge.key)) repeatedMeters += edge.meters;
      used.add(edge.key);
      edgeKeys.push(edge.key);
    }
    const distance = routeLength(coordinates);
    const quality = routeScore(outline, coordinates, distance, targetMeters, repeatedMeters);
    if (!best || quality > best.quality) best = { coordinates, distance, quality, edgeKeys };
  }
  return best;
}

function selectSearchCandidates(candidates: Array<PreparedCandidate & { index: number }>, targetMeters: number, searchLimit = MAX_SEARCH_CANDIDATES) {
  const minimumSpacing = Math.max(180, Math.min(650, targetMeters * .08));
  const selected: Array<PreparedCandidate & { index: number }> = [];
  const used = new Set<number>();
  const selectedVariants = new Set<string | undefined>();
  const selectedDistances = new Set<number>();
  for (const candidate of candidates) {
    const variant = candidate.candidate.variant;
    const targetDistance = candidate.candidate.targetDistance;
    if (selectedVariants.has(variant) || selectedDistances.has(targetDistance)) continue;
    selected.push(candidate);
    used.add(candidate.index);
    selectedVariants.add(variant);
    selectedDistances.add(targetDistance);
    if (selected.length >= searchLimit) return selected;
  }
  for (const candidate of candidates) {
    const targetDistance = candidate.candidate.targetDistance;
    if (used.has(candidate.index) || selectedDistances.has(targetDistance)) continue;
    selected.push(candidate);
    used.add(candidate.index);
    selectedDistances.add(targetDistance);
    if (selected.length >= searchLimit) return selected;
  }
  for (const candidate of candidates) {
    const variant = candidate.candidate.variant;
    if (used.has(candidate.index) || selectedVariants.has(variant)) continue;
    selected.push(candidate);
    used.add(candidate.index);
    selectedVariants.add(variant);
    if (selected.length >= searchLimit) return selected;
  }
  for (const candidate of candidates) {
    if (used.has(candidate.index)) continue;
    if (selected.every((item) => distanceMeters(item.center, candidate.center) >= minimumSpacing)) {
      selected.push(candidate);
      used.add(candidate.index);
      if (selected.length >= searchLimit) return selected;
    }
  }
  for (const candidate of candidates) {
    if (used.has(candidate.index)) continue;
    selected.push(candidate);
    if (selected.length >= searchLimit) break;
  }
  return selected;
}

function selectDistinctRoutes<T extends { quality: number; edgeKeys: string[]; variant?: string; targetDistance: number }>(routes: T[], limit = 3) {
  const selected: T[] = [];
  const sorted = [...routes].sort((left, right) => right.quality - left.quality);
  const isDistinct = (route: T) => {
    const routeEdges = new Set(route.edgeKeys);
    return !selected.some((other) => {
      const otherEdges = new Set(other.edgeKeys);
      const overlap = routeEdges.size && otherEdges.size
        ? [...routeEdges].reduce((count, key) => count + Number(otherEdges.has(key)), 0) / Math.min(routeEdges.size, otherEdges.size)
        : 1;
      return overlap >= .78;
    });
  };
  const selectedVariants = new Set<string | undefined>();
  const selectedDistances = new Set<number>();
  for (const route of sorted) {
    if (selectedVariants.has(route.variant) || selectedDistances.has(route.targetDistance) || !isDistinct(route)) continue;
    selected.push(route);
    selectedVariants.add(route.variant);
    selectedDistances.add(route.targetDistance);
    if (selected.length >= limit) break;
  }
  for (const route of sorted) {
    if (selected.length >= limit) break;
    if (!selected.includes(route) && !selectedDistances.has(route.targetDistance) && isDistinct(route)) {
      selected.push(route);
      selectedDistances.add(route.targetDistance);
    }
  }
  for (const route of sorted) {
    if (selected.length >= limit) break;
    if (!selected.includes(route) && !selectedVariants.has(route.variant) && isDistinct(route)) {
      selected.push(route);
      selectedVariants.add(route.variant);
    }
  }
  for (const route of sorted) {
    if (selected.length >= limit) break;
    if (!selected.includes(route) && isDistinct(route)) selected.push(route);
  }
  return selected;
}

export async function POST(request: Request) {
  let body: { candidates?: unknown; targetDistance?: unknown; area?: unknown; discoverShapes?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid route search request." }, { status: 400 }); }
  if (!Array.isArray(body.candidates) || body.candidates.length < 1 || body.candidates.length > MAX_CANDIDATES || typeof body.targetDistance !== "number" || !Number.isFinite(body.targetDistance) || body.targetDistance < 1_000 || body.targetDistance > 30_000) {
    return Response.json({ error: "Route search needs up to 217 outlines and a valid target distance." }, { status: 400 });
  }
  const area = body.area === undefined ? undefined : validArea(body.area) ? body.area : null;
  if (area === null) return Response.json({ error: "The selected map area is invalid." }, { status: 400 });
  const candidates: Candidate[] = [];
  for (const value of body.candidates) {
    if (!value || typeof value !== "object") return Response.json({ error: "Invalid art outline." }, { status: 400 });
    const candidate = value as { name?: unknown; variant?: unknown; targetDistance?: unknown; outline?: unknown };
    const targetDistance = candidate.targetDistance === undefined ? body.targetDistance as number : candidate.targetDistance;
    if (typeof candidate.name !== "string" || (candidate.variant !== undefined && (typeof candidate.variant !== "string" || candidate.variant.length > 80)) || typeof targetDistance !== "number" || !Number.isFinite(targetDistance) || targetDistance < 1_000 || targetDistance > 30_000 || !Array.isArray(candidate.outline) || candidate.outline.length < 3 || candidate.outline.length > MAX_ANCHORS || !candidate.outline.every(validPoint)) {
      return Response.json({ error: "Each outline needs between three and 64 valid map points." }, { status: 400 });
    }
    if (area && candidate.outline.some((point) => !insideArea(point, area))) return Response.json({ error: "An outline falls outside the selected map area." }, { status: 400 });
    candidates.push({ name: candidate.name.slice(0, 60), variant: typeof candidate.variant === "string" ? candidate.variant : undefined, targetDistance, outline: candidate.outline });
  }
  try {
    const graph = await loadGraph(candidates, area);
    const trees = new Map<number, SearchTree>();
    const ranked = candidates.map((candidate, index) => {
      const prepared = prepareCandidate(graph, candidate, candidate.targetDistance, area);
      return prepared ? { ...prepared, index } : null;
    }).filter((candidate): candidate is PreparedCandidate & { index: number } => candidate !== null)
      .sort((left, right) => left.score - right.score);
    const searchLimit = body.discoverShapes === true ? MAX_DISCOVERY_SEARCH_CANDIDATES : MAX_SEARCH_CANDIDATES;
    const searchCandidates = selectSearchCandidates(ranked, body.targetDistance as number, searchLimit);
    const routes = searchCandidates.flatMap((prepared) => {
      const result = searchCandidate(graph, prepared.candidate.outline, prepared.anchors, prepared.candidate.targetDistance, trees, area);
      return result ? [{ index: prepared.index, name: prepared.candidate.name, variant: prepared.candidate.variant, targetDistance: prepared.candidate.targetDistance, ...result }] : [];
    });
    const routeOptions = selectDistinctRoutes(routes);
    if (!routeOptions.length) return Response.json({ error: "No connected walkable street route was found near this outline." }, { status: 422 });
    const publicRoutes = routeOptions.map((route) => ({ index: route.index, name: route.name, coordinates: route.coordinates, distance: route.distance, quality: route.quality }));
    return Response.json({ routes: publicRoutes, source: "OpenStreetMap pedestrian street graph" }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "map-data-unavailable";
    const error = reason === "area-too-large" ? "The art outline covers too large an area to search." : "Street network search is unavailable right now.";
    return Response.json({ error }, { status: 503 });
  }
}
