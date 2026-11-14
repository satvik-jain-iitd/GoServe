// Boards O0g-F and SP1 (stories 1374, 1385): a thali with no box that sets itself. The plate turns in, each dish pops in after the one before, steam rises;
// a 6 s loop, CSS only. Reduced motion: it stands still and whole. The plate carries the picture's name; the dishes and the steam are hidden from screen readers.
const DISHES = ["rotis", "rice", "dal", "paneer", "raita", "salad"];

export function Thali({ className = "" }: { className?: string }) {
  return (
    <div className={`ui-thali ${className}`.trim()}>
      <img className="p" src="/brand/thali/p.png" alt="A thali from our kitchen" />
      {DISHES.map((d) => <img key={d} className={d} src={`/brand/thali/${d}.png`} alt="" aria-hidden="true" />)}
      <svg className="steam" viewBox="0 0 295 348" aria-hidden="true">
        <path d="M102.4 95.6 C93.4 81.1 111.4 66.6 102.4 57.9 C96.4 50.7 101.4 43.4 104.4 37.6" />
        <path d="M147.6 87.6 C138.6 70.6 156.6 53.6 147.6 43.4 C141.6 34.9 146.6 26.4 149.6 19.6" />
        <path d="M192.7 95.6 C183.7 81.1 201.7 66.6 192.7 57.9 C186.7 50.7 191.7 43.4 194.7 37.6" />
      </svg>
    </div>
  );
}
