// Story #1049 part 2 (board N0): first open, after the number, the customer is asked for order alerts once, so they never have to find the switch in the profile.
// Turn on asks the phone's notification permission and moves on either way; Not now moves on and the profile switch stays off.
type Props = { busy: boolean; onTurnOn: () => void; onNotNow: () => void };

export function AlertsAsk({ busy, onTurnOn, onNotNow }: Props) {
  return (
    <section className="ui-landing">
      <header className="ui-landing-head">
        <h1><img className="ui-logo ui-lockup" src="/brand/lockup-day.png" alt="GoServe" width="350" height="50" /></h1>
        <div className="ui-zigzag" aria-hidden="true" />
        <p className="ui-kicker">Hot meals from our kitchen for you in 20 mins</p>
      </header>
      <div className="ui-slip" role="group" aria-label="Order alerts">
        <div className="ui-slip-body">
          <div className="ui-slip-head"><span>Order alerts</span><span>Step 2 of 4</span></div>
          <h2 className="ui-slip-title">Get order alerts</h2>
          <span aria-hidden="true" className="ui-bellbadge"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg></span>
          <button type="button" className="ui-btn big" disabled={busy} onClick={onTurnOn}>Turn on alerts</button>
          <button type="button" className="ui-btn ghost big" disabled={busy} onClick={onNotNow}>Not now</button>
        </div>
      </div>
    </section>
  );
}
