import { VerifyWorkspace } from "./verify-workspace";

export default function Home() {
  return (
    <main>
      <header className="masthead"><a className="wordmark" href="#top">AuditScope</a><span>Audit-to-deployment coverage</span></header>
      <section className="intro" id="top">
        <p className="eyebrow">Base contract evidence</p>
        <h1>Audited doesn&apos;t always mean covered.</h1>
        <p>Verify whether a published security audit actually maps to the smart contracts running onchain today.</p>
      </section>
      <VerifyWorkspace />
      <footer>AuditScope verifies audit-to-deployment coverage. It does not determine whether a contract is secure or free of vulnerabilities.</footer>
    </main>
  );
}
