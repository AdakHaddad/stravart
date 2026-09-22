RouteBuddy turns a location and an art prompt into a walkable GPX route. It uses OpenRouteService (ORS) for server-side geocoding and pedestrian routing, so routes are generated from real map data instead of fixed demo coordinates.

## Production configuration

Create an ORS API key and set `ORS_API_KEY` in your hosting provider's server-side environment settings. Do not prefix it with `NEXT_PUBLIC_`, commit a token, or create an `.env` file. RouteBuddy proxies ORS through same-origin Route Handlers, so the key never reaches a browser bundle.

For the interactive map, provide your Mapbox public token via `NEXT_PUBLIC_MAPBOX_TOKEN` or `MAPBOX_PUBLIC_TOKEN`.

Without that variable, the app stays safe: live place search and route generation return a configuration error without exposing a credential.

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
