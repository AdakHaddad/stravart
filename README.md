RouteBuddy turns a place or the visible map area plus an art prompt into up to three distinct walkable GPX route options. Leave the art prompt blank to compare all 22 built-in silhouettes and let the street match choose the shape; with a distance range, it samples low, middle, and high lengths. Place search returns ranked suggestions and reverse-geocodes map clicks using Photon (OpenStreetMap data), with OpenRouteService (ORS) Pelias as a fallback. Route search downloads nearby walkable streets from OpenStreetMap's Overpass API, searches up to 217 combinations of rotation, scale, placement, and length against that street graph, and favors closed loops for closed shapes. Each candidate is scored against its own target length. Area searches stay within the visible map bounds and rank candidates from across that area. Shape discovery graph-searches up to one candidate per silhouette; prompt-based searches keep the smaller search budget. It falls back to ORS directions when graph search is unavailable. The local prompt interpreter supports a curated set of subjects and two-shape compositions without an AI service; generic cat prompts compare six styles: cat with tail, side profile, raised tail, low walking, sitting, and cat face. Unknown subjects get a clearly labeled abstract line instead of a library-only error.

Three cat silhouettes are adapted and simplified from drawings 5438790044745728, 4888094618681344, and 5726549275836416 in Google's [Quick, Draw! Dataset](https://github.com/googlecreativelab/quickdraw-dataset). The dataset is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Production configuration

For ORS fallback routing and place-search fallback, create an ORS API key and set `ORS_API_KEY` in your hosting provider's server-side environment settings. Do not prefix it with `NEXT_PUBLIC_`, commit a token, or create an `.env` file. RouteBuddy proxies ORS through same-origin Route Handlers, so the key never reaches a browser bundle.

For the interactive map, provide your Mapbox public token via `NEXT_PUBLIC_MAPBOX_TOKEN` or `MAPBOX_PUBLIC_TOKEN`.

Graph search uses the public Overpass API and needs no credential. Requests are cached in memory for 30 minutes per running server instance; for sustained traffic, use a hosted or cached OpenStreetMap graph instead of relying on public Overpass capacity. If graph search is unavailable, route generation falls back to ORS and therefore needs `ORS_API_KEY`. Without a Mapbox token, the map falls back to a static art preview. No credential is exposed to the browser.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
