// Story 1785: the one no-internet screen. The menu and the Bill both show it; it is never copied.
// Board M6: no connection and no saved menu. The whole screen, no header, no tabs.
export function OfflineEmpty({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="ui-offline-empty">
      <svg aria-hidden="true" viewBox="0 0 240 180" width="240" height="180" fill="none" stroke="var(--md-on-surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M40 118h160" stroke="var(--md-outline-variant)" />
        <path d="M60 110c0-26 27-40 60-40s60 14 60 40z" fill="var(--md-surface-variant)" />
        <path d="M60 110h120" />
        <path d="M180 92l34-14" />
        <circle cx="216" cy="77" r="4" fill="var(--md-on-surface)" />
        <ellipse cx="120" cy="96" rx="30" ry="9" fill="var(--gs-status-cooking)" />
        <path d="M84 118v18M156 118v18" />
        <path d="M78 136h12M150 136h12" />
        <path d="M120 30c-8 0-14 6-14 14" stroke="var(--md-outline)" strokeDasharray="2 4" />
        <path d="M120 16c-16 0-28 12-28 28" stroke="var(--md-outline)" strokeDasharray="2 4" />
        <path d="M120 2c-24 0-42 18-42 42" stroke="var(--md-outline)" strokeDasharray="2 4" />
        <path d="M128 28l18 18M146 28l-18 18" stroke="var(--md-error)" />
      </svg>
      <div role="alert">
        <p className="ui-offline-title">Could not connect to the internet.</p>
        <p className="ui-offline-line">Check your network, then try again.</p>
      </div>
      <button type="button" className="ui-btn ghost" onClick={onRetry}>Try again</button>
    </div>
  );
}
