"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="error-page"><p className="section-label">SOMETHING WENT OFF ROUTE</p><h1>We couldn’t load this route.</h1><p>Try again, or head back to the start and create a new one.</p><button className="primary" type="button" onClick={reset}>Try again <span>→</span></button><Link href="/">Back to RouteBuddy</Link></main>;
}
