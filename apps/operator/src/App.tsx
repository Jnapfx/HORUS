import { useEffect, useState } from 'react'
import './App.css'

type FoundationStatus = Awaited<ReturnType<NonNullable<Window['horus']>['foundation']['getStatus']>>
type IntegrationContract = Awaited<ReturnType<NonNullable<Window['horus']>['foundation']['getIntegrationContracts']>>[number]

function App() {
  const [status, setStatus] = useState<FoundationStatus | null>(null)
  const [contracts, setContracts] = useState<IntegrationContract[]>([])

  useEffect(() => {
    void window.horus?.foundation.getStatus().then(setStatus)
    void window.horus?.foundation.getIntegrationContracts().then(setContracts)
  }, [])

  return (
    <main className="foundation-shell">
      <header>
        <div className="brand-mark" aria-hidden="true">◉</div>
        <div><p className="eyebrow">HORUS V1 · LOCAL OPERATOR</p><h1>Technical foundation</h1></div>
        <span className="status">Ready for vertical workflow</span>
      </header>
      <section className="hero-panel">
        <div><p className="eyebrow">PHASE 3</p><h2>Evidence stays local. Approval stays explicit.</h2><p>Electron hosts the operator workspace. The visible UI never receives credentials or direct filesystem access.</p></div>
        <div className="decision"><span>Outreach boundary</span><strong>Credential-free Gmail compose handoff</strong><small>DEC-041 · HORUS cannot send.</small></div>
      </section>
      <section className="grid">
        <article><h2>Immutable evidence</h2><p>Raw source snapshots are content-addressed JSON files. Derived scores and activity history live separately in SQLite.</p><span>Raw → manifest → derived</span></article>
        <article><h2>Trusted boundary</h2><p>Renderer ↔ typed preload bridge ↔ Electron main process. External adapters remain behind this boundary.</p><span>UI never holds credentials</span></article>
        <article><h2>Publication control</h2><p>Static demonstration assets are built locally. Cloudflare deployment is reserved for an approved command.</p><span>No automatic Git deployment</span></article>
      </section>
      <section className="storage-panel"><div><p className="eyebrow">LOCAL STORE</p><h2>{status ? 'SQLite and evidence store initialized' : 'Checking local store…'}</h2></div><dl><div><dt>Raw snapshots</dt><dd>{status?.rawSnapshotCount ?? '—'}</dd></div><div><dt>Domain events</dt><dd>{status?.eventCount ?? '—'}</dd></div><div><dt>Data directory</dt><dd>{status?.dataDirectory ?? 'Electron runtime required'}</dd></div></dl></section>
      <section className="contract-panel"><p className="eyebrow">INTEGRATION CONTRACTS</p><h2>Capabilities are visible; credentials stay local.</h2><ul>{contracts.map((contract) => <li key={contract.id}><strong>{contract.label}</strong><span>{contract.credentialBoundary === 'no-credential' ? 'No credential' : 'Credential stays in main process'}</span><small>{contract.approvalRequirement}</small></li>)}</ul></section>
    </main>
  )
}

export default App
