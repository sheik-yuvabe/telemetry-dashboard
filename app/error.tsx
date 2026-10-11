"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="workspace-main"><section className="panel empty-state"><h1>The workspace couldn’t load.</h1><p>Check the database connection and Batch 2 migration, then try again.</p><button className="primary-button" onClick={reset} style={{ marginTop: 20 }}>Try again</button></section></main>;
}
