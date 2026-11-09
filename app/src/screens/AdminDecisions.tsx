// Story #263, changed by story #1068: the admin's Decisions block. The database decides with the Rules (free rider with the fewest trips, then the shortest way); Jev and Laya
// are not part of the live path now, so there is nothing to switch and no call from this block.
export function AdminDecisions() {
  return (
    <section className="ui-group" aria-label="Decisions">
      <h2>Decisions</h2>
      <p className="ui-meta">Who picks the rider for each ready order.</p>
      <div className="ui-row ui-row-static">
        <label htmlFor="engine-rules" className="ui-row-label"><span>Rules</span><span className="ui-row-sub">Free rider with the fewest trips, then the shortest way. No outside call. Cost zero.</span></label>
        <input id="engine-rules" type="radio" name="engine" checked disabled readOnly />
      </div>
    </section>
  );
}
