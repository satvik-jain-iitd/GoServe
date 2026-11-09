// Demo tools: the autopilot. (Copy-link and Reset were retired in story #938: they let one account reach another's orders.)
type Props = { autoOn: boolean; autoNote: string | null; onAuto: () => void };

export function DemoBar({ autoOn, autoNote, onAuto }: Props) {
  return (
    <div className="demobar">
      <button type="button" className={autoOn ? "btn small" : "btn small ghost"} aria-pressed={autoOn} onClick={onAuto}>Autopilot</button>
      {autoNote && <p role="status" className="note">{autoNote}</p>}
    </div>
  );
}
