import Link from "next/link";

export default function NotFound() {
  return <main className="error-page"><p className="section-label">404 / LOST ROUTE</p><h1>This route doesn’t exist.</h1><p>The page may have moved, or the link is incomplete.</p><Link className="primary" href="/">Back to RouteBuddy <span>→</span></Link></main>;
}
