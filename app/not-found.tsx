import Link from "next/link";

export default function NotFound() {
  return <main className="not-found" id="main-content">
    <p className="section-index">404 / no evidence located</p>
    <h1>This route is outside the audit scope.</h1>
    <p>The requested page does not exist. Return to the verification docket to inspect a live deployment.</p>
    <Link className="hero-cta" href="/">Return to AuditScope <span aria-hidden="true">→</span></Link>
  </main>;
}
