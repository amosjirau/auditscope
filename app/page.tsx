import { VerifyWorkspace } from "./verify-workspace";

export default function Home() {
  return (
    <>
      <header className="masthead" id="top">
        <a className="wordmark" href="#top"><span aria-hidden="true">A/</span>AuditScope</a>
        <nav aria-label="Primary navigation">
          <a href="#verify">Verify</a>
          <a href="#method">Method</a>
          <a href="https://github.com/amosjirau/auditscope" target="_blank" rel="noreferrer">Source ↗</a>
        </nav>
        <span className="network-mark">Base evidence network</span>
      </header>
      <main id="main-content">
        <section className="intro" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Audit-to-deployment coverage intelligence</p>
            <h1 id="hero-title">Audited doesn&apos;t always mean <em>covered.</em></h1>
            <p>AuditScope checks whether a published security audit still maps to the exact smart-contract code running onchain today.</p>
            <a className="hero-cta" href="#verify">Open verification docket <span aria-hidden="true">↓</span></a>
          </div>
          <aside className="validation-note" aria-label="Live validation record">
            <div><span>Validation record</span><strong>295c541</strong></div>
            <p>Controlled onchain fixtures. Real Gemini extraction. Exact Sourcify evidence.</p>
            <dl>
              <div><dt>Reliability</dt><dd>10 / 10</dd></div>
              <div><dt>Network</dt><dd>Base Sepolia</dd></div>
              <div><dt>States proven</dt><dd>04</dd></div>
            </dl>
          </aside>
        </section>

        <section className="method-strip" id="method" aria-label="AuditScope method">
          <p><span>AI responsibility</span>Read the PDF and extract cited scope claims.</p>
          <i aria-hidden="true">→</i>
          <p><span>Deterministic responsibility</span>Compare GitHub, Sourcify, and Base evidence to issue the verdict.</p>
        </section>

        <VerifyWorkspace />
      </main>
      <footer>
        <div><a className="wordmark" href="#top"><span aria-hidden="true">A/</span>AuditScope</a><p>Coverage verification for smart-contract audits.</p></div>
        <p>AuditScope verifies audit-to-deployment coverage. It does not determine whether a contract is secure or free of vulnerabilities.</p>
      </footer>
    </>
  );
}
