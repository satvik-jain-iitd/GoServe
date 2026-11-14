// Story #1037 (boards C6-PinMap, C9-EditOnMap later): the one full-screen map for every location pick. A plain DOM pin sits at the centre of the map box and the map moves under it
// (never a Leaflet marker). 400 ms after it stops the words (Ola through lib/locate, OpenStreetMap as the fallback) and the served strip follow the centre. No zoom control (pinch and double tap
// only), no inline map anywhere. The phone's place is a brown dot only when location is already allowed; this screen never asks for it by itself.
import { useEffect, useRef, useState } from "react";
import { useBackCloses } from "../lib/back";
import { renderToStaticMarkup } from "react-dom/server";
import { ClearCross, DishPlate, JoinedBar } from "../ui";
import { fetchKitchens } from "../lib/area";
import { getClient } from "../lib/supabase";
import type { Map as LMap, Marker } from "leaflet";
import { currentPlace, findAddress, type Looked, type Place } from "../lib/locate";
import { isPin } from "../lib/area";
import type { PlaceHit } from "../lib/placeSearch";
import { addressText, boxOf, cardWords, serveAt, stripsFor, type Serve, type Strip } from "../lib/pinMap";
import { metres, tileUrl } from "../lib/riderMap";

const TILES = tileUrl(import.meta.env.VITE_MAP_TILES);
const SETTLE_MS = 400;
const LOOKUP_MS = 6000;   // story 1393: a lookup that never answers ends here; the place-only answer then stands
// Story 1426: a lookup or serve call that never answers counts as no answer after LOOKUP_MS.
const limit = <T,>(p: Promise<T>): Promise<T | null> => Promise.race([p, new Promise<null>((ok) => setTimeout(() => ok(null), LOOKUP_MS))]);
const OSM = "https://www.openstreetmap.org/copyright";
const I = (d: React.ReactNode, w = 22) => <svg aria-hidden="true" width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const PIN_PATH = <><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>;

export type PinPick = { at: Place; words: Looked | null; served: boolean | null };
export type Saved = { pin: string; address: string; label: string; from: Place; house: string; landmark: string };   // story 1421: the box and the landmark, whole   // story #1038: what the details step hands to the save
type Props = {
  center: Place; zoom?: number; kicker?: string; confirmLabel: string;
  onInvite?: (far: { at: Place; pin: string; address: string }) => Promise<string | null>;   // story #1128 (board C6d): a pin no kitchen reaches. The button reads Invite the founders here; it saves the ask and opens the founder note. Answers an error in words, or null; not used when editing
  kitchensNear?: () => Promise<{ lat: number | null; lng: number | null; synthetic?: boolean }[]>;   // story #1138 (board C6e): the GoServe kitchens drawn on the map; tests give their own
  edit?: { label: string; address: string };   // story #1051 (board C9): the saved row being changed; the details open filled with it
  kitchen?: { pins: string[] };   // story #1052 (board A12): a kitchen's place. No serviceability, no details step: Confirm hands the point back. "Inside <pin>" when the words are in one of its pin codes
  onPoint?: (p: { at: Place; words: Looked | null }) => void;

  search?: (q: string) => Promise<PlaceHit[] | null>; searchOpen?: boolean;   // story #1127 (boards C6, C8): with a search function the bar searches ON the map: results over it, a pick moves the pin. Without one, onSearch leaves the map as before
  onBack: () => void; onSearch: () => void; onSave: (a: Saved) => void;
  lookup?: (p: Place) => Promise<Looked | null>; serve?: (p: Place, pin: string | null) => Promise<Serve | null>;
};

export function PinMapScreen({ center, zoom = 17, kicker, confirmLabel, edit, kitchen, onInvite, kitchensNear = async () => await fetchKitchens(getClient()), onPoint, search, searchOpen, onBack, onSearch, onSave, lookup = (p) => findAddress(p.lat, p.lng), serve = (p, pin) => (kitchen ? Promise.resolve(null) : serveAt(p, undefined, pin)) }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const live = useRef<{ map: LMap; L: typeof import("leaflet"); dot: Marker | null } | null>(null);
  const [point, setPoint] = useState<Place>(center);
  const [words, setWords] = useState<Looked | null>(null);
  const [failed, setFailed] = useState(false);
  const [served, setServed] = useState<Serve | null>(null);
  const [noAnswer, setNoAnswer] = useState(false);   // story 1426 (board PE1): the serve check for the place under the pin gave no answer
  const [busy, setBusy] = useState(true);
  const [here, setHere] = useState<Place | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const card = useRef<HTMLDivElement>(null);
  useBackCloses(true, onBack);   // story 1415: the phone's Back closes the map
  // Story 1392: how far the pin's point sits above the middle of the map (0 on a tall screen and on the details step). The map stays full height,
  // behind the whole card; the place is read at the pin and a place is shown at the pin, not at the middle.
  const lift = useRef(0);
  const liftNow = () => (root.current?.dataset.step === "pin" ? lift.current : 0);
  const pinAt = (map: LMap) => {
    const k = liftNow();
    if (!k) return map.getCenter();
    const size = map.getSize();
    return map.containerPointToLatLng([size.x / 2, size.y / 2 - k]);
  };
  const show = (map: LMap, at: { lat: number; lng: number }, z: number) => {
    const k = liftNow();
    map.setView(k ? map.unproject(map.project([at.lat, at.lng], z).add([0, k]), z) : [at.lat, at.lng], z, { animate: false });
  };
  const [sOpen, setSOpen] = useState(!!searchOpen && !!search);   // story #1127: the search bar is open (a text box and, after Enter, the places)
  const [sq, setSq] = useState("");
  useBackCloses(!!search && sOpen, () => { setSOpen(false); setFound(null); setSq(""); });   // story 1248: the phone's Back closes the open search first, like the arrow
  const sRef = useRef<HTMLInputElement>(null);
  const [found, setFound] = useState<{ words: string; state: "busy" | "short" | "error" | "ok"; hits: PlaceHit[] } | null>(null);
  const runSearch = async () => {
    const w = sq.trim();
    if (w.length < 3) return setFound({ words: w, state: "short", hits: [] });
    setFound({ words: w, state: "busy", hits: [] });
    const hits = await search!(w);
    setFound((c) => (c && c.words === w ? { words: w, state: hits === null ? "error" : "ok", hits: hits ?? [] } : c));
  };
  const take = (h: PlaceHit) => { setSOpen(false); setFound(null); setSq(""); const m = live.current?.map; if (m) show(m, { lat: h.lat, lng: h.lng }, 17); };   // the move settles the pin through the map's own move end
  const [pick, setPick] = useState<PinPick | null>(null);
  const draft = useRef<Draft | null>(null);   // story 1421 (board ED2): what was typed on the sheet, kept across Change and back   // story #1038: set when Confirm is tapped; the details sheet shows over the same map
  const ask = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fns = useRef({ lookup, serve });
  fns.current = { lookup, serve };

  // Story 1389 (board PH1): the hint shows until this person moves the map once on this phone. Moves the app makes (centring, Current Location, a search pick) do not count.
  const [cramped, setCramped] = useState(false);
  const [moved, setMoved] = useState(() => { try { return localStorage.getItem("gs-pin-moved") === "1"; } catch { return false; } });
  const byHand = () => { setMoved(true); try { localStorage.setItem("gs-pin-moved", "1"); } catch { /* blocked: it shows again next time */ } };
  const settled = useRef<Place | null>(null);
  const settle = (p: Place) => {   // the pin rests: one lookup and one serviceability answer for the last place only
    // Story 1393: a screen size change moves the map but not the place under the pin. Same place (under a metre): no new lookup, so no flash.
    if (settled.current && metres(settled.current.lat, settled.current.lng, p.lat, p.lng) < 1) return;
    settled.current = p;
    setPoint(p);
    setBusy(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const mine = ++ask.current;
      // The strip does not wait for the lookup (a slow Ola or OpenStreetMap read once hid it for good): it is asked at once with the place, and again with the pin the lookup reads.
      let pinAnswered = false;   // the pin answer is the better one: a slow place-only answer must not overwrite it
      // Story 1393: the server decides by pin code, so a place-only "not served" can be false. It is shown at once only when it says yes; a no waits for the pin answer.
      const placeOnly = limit(fns.current.serve(p, null)).catch(() => null);
      void placeOnly.then((s0) => { if (mine === ask.current && s0?.serviceable && !pinAnswered) setServed(s0); });
      const w = await limit(fns.current.lookup(p).catch(() => null));
      if (mine !== ask.current) return;   // a newer rest has taken over
      if (w) { setWords(w); setFailed(false); } else { setWords(null); setFailed(true); }   // story 1462: the pin moved and no name came: "Pin on the map", never the old place's name
      // story #1102: the pin the lookup read goes with the place; no pin read: the place-only answer stands. Story 1426: a failed pin answer falls back only to a place-only yes.
      const s0 = await placeOnly;
      const s = w?.pin ? ((await limit(fns.current.serve(p, w.pin)).catch(() => null)) ?? (s0?.serviceable ? s0 : null)) : s0;
      if (mine !== ask.current) return;
      if (s) { pinAnswered = true; setServed(s); setNoAnswer(false); }
      else if (!kitchen) { setServed(null); setNoAnswer(true); }   // story 1426: never another place's answer; Try again instead of Confirm
      if (!w || !s) settled.current = null;   // story 1393: a failed ask is not a settled place; the next rest there asks again
      setBusy(false);
    }, SETTLE_MS);
  };
  const settleRef = useRef(settle);
  settleRef.current = settle;

  // Story #1138 (board C6e): each GoServe kitchen with a place is drawn as the #937 plate with its tag. Not interactive. Where its art would touch the pin it is taken off the map,
  // and where its tag would run under the pin or the card the tag is hidden, so the pin and the card are never covered.
  const drawKitchens = (L: typeof import("leaflet"), map: LMap, list: { lat: number | null; lng: number | null; synthetic?: boolean }[]) => {
    const html = renderToStaticMarkup(<span className="gs-kitchen-in"><DishPlate size={28} stroke="var(--md-primary)" halo /><span className="gs-kitchen-tag">GoServe Kitchen</span></span>);
    const marks = list.filter((k): k is { lat: number; lng: number; synthetic?: boolean } => typeof k.lat === "number" && typeof k.lng === "number" && !k.synthetic)
      .map((k) => L.marker([k.lat, k.lng], { interactive: false, keyboard: false, zIndexOffset: -500, icon: L.divIcon({ className: "gs-kitchen-mark", iconSize: [0, 0], html }) }));
    const hits = (a: DOMRect, b: DOMRect) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    const place = () => {
      const avoid = [".ui-pinmap-pin", ".ui-pinmap-card", ".ui-pinmap-top"].map((q) => root.current?.querySelector(q)?.getBoundingClientRect()).filter((r): r is DOMRect => !!r);
      for (const m of marks) {
        if (!map.getBounds().pad(0.2).contains(m.getLatLng())) { if (map.hasLayer(m)) m.remove(); continue; }
        if (!map.hasLayer(m)) m.addTo(map);
        const el = m.getElement();
        const art = el?.querySelector("svg")?.getBoundingClientRect(), tag = el?.querySelector(".gs-kitchen-tag")?.getBoundingClientRect();
        if (art && avoid.some((r) => hits(art, r))) { m.remove(); continue; }   // never under the pin or the card
        if (tag) el?.classList.toggle("no-tag", avoid.some((r) => hits(tag, r)));
      }
    };
    map.on("moveend zoomend resize", place);
    place();
  };

  useEffect(() => {
    let gone = false;
    let watch: number | null = null;
    void Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]).then(([L]) => {
      if (gone || !box.current) return;
      const map = L.map(box.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, boxZoom: false, keyboard: false }).setView([center.lat, center.lng], zoom, { animate: false });
      if (TILES) L.tileLayer(TILES, { maxZoom: 19 }).addTo(map);
      map.on("moveend", () => { const c = pinAt(map); settleRef.current({ lat: c.lat, lng: c.lng }); });
      map.on("dragstart dblclick", byHand);   // story 1389: a drag or a double tap by the person
      box.current.addEventListener("touchstart", (e) => { if (e.touches.length > 1) byHand(); }, { passive: true });   // a pinch
      live.current = { map, L, dot: null };
      if (liftNow()) show(map, center, zoom);   // 1392: a short screen measured before the map came: put the start place under the pin
      if (!kitchen) void kitchensNear().then((list) => drawKitchens(L, map, list), () => undefined);   // story #1138: not on the kitchen admin's own pin screen
      settleRef.current(center);
      void navigator.permissions?.query({ name: "geolocation" as PermissionName }).then((perm) => {   // only when already allowed: this screen never asks
        if (gone || perm.state !== "granted" || !("geolocation" in navigator)) return;
        watch = navigator.geolocation.watchPosition((p) => {
          const at = { lat: p.coords.latitude, lng: p.coords.longitude };
          setHere(at);
          const m = live.current;
          if (!m) return;
          if (!m.dot) m.dot = m.L.marker([at.lat, at.lng], { interactive: false, keyboard: false, icon: m.L.divIcon({ className: "gs-here-dot", iconSize: [26, 26], iconAnchor: [13, 13], html: "<i></i>" }) }).addTo(m.map);
          else m.dot.setLatLng([at.lat, at.lng]);
        }, () => undefined, { enableHighAccuracy: true });
      }).catch(() => undefined);
    });
    return () => {
      gone = true;
      if (timer.current) clearTimeout(timer.current);
      if (watch !== null) navigator.geolocation.clearWatch(watch);
      live.current?.map.remove(); live.current = null;
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const held = useRef<Place | null>(null);   // the confirmed pin while the details sheet is open
  useEffect(() => {   // the map stays behind the sheet, still, and shrinks to the part above it so the pin stays in view
    const m = live.current;
    if (!m) return;
    const h = m.map;
    for (const x of [h.dragging, h.touchZoom, h.doubleClickZoom]) (pick ? x.disable() : x.enable());
    const c = pick ? pick.at : held.current;   // bug #1203: on Change the map box grows back; without this the centre, and so the pin, slid about 260 m
    held.current = pick ? pick.at : null;
    h.invalidateSize({ pan: false });
    if (c) show(h, c, h.getZoom());
  }, [pick]);

  const toPhone = async () => {
    setNote(null);
    try {
      const p = await currentPlace();
      const m = live.current?.map;
      if (m) show(m, p, 17);
    } catch {
      setNote("Could not get your location. Allow location and try again.");
    }
  };

  const name = cardWords(words?.address ?? null);
  const was = edit ? boxOf(edit, words?.address ?? "") : null;   // board C9: Editing shows the saved box and landmark in front of the words of the pin
  const editLine = was ? [was.house, was.landmark ? `near ${was.landmark}` : ""].filter(Boolean).join(", ") : "";
  // story #1128 (board C6d): a pin no kitchen reaches, read as a valid pin. The main button invites the founders instead of confirming.
  const far = !edit && !kitchen && onInvite && served?.serviceable === false && words?.pin && isPin(words.pin) ? { at: point, pin: words.pin, address: words.address } : null;
  const [sending, setSending] = useState(false);
  const opened = useRef(false);
  useEffect(() => {   // story 1421 (board ED1): Edit opens the filled sheet; the map's own step shows only on Change
    if (!edit || opened.current || busy || (!words && !failed)) return;
    opened.current = true;
    setPick({ at: point, words, served: served ? served.serviceable : null });
  }, [busy, words, failed]);   // once, when the first lookup at the saved pin has answered
  const invite = async (f: NonNullable<typeof far>) => {
    setNote(null); setSending(true);
    const err = await onInvite!(f).catch(() => "Could not set that up. Try again.");
    setSending(false);
    if (err) setNote(err);
  };
  // Story 1392 (board A1p): on a short screen the pin rises so the Current Location button never covers it. The map stays behind the whole card;
  // the place is read at the pin (pinAt) and shown at the pin (show). A tall screen keeps the pin in the middle.
  useEffect(() => {
    const r = root.current, c = card.current;
    if (pick || !r || !c || typeof ResizeObserver === "undefined") return;
    const fit = () => {
      const here = c.querySelector(".ui-pinmap-here")?.getBoundingClientRect();
      if (!here) return;
      const h = r.clientHeight;
      const room = here.top - r.getBoundingClientRect().top - 38;   // the pin box ends 30 px below its point, then an 8 px gap
      const k = Math.max(0, Math.round(h / 2 - room));
      if (k !== lift.current) {
        const map = live.current?.map, at = map ? pinAt(map) : null;   // read with the old lift, before it changes
        lift.current = k;
        r.style.setProperty("--pin-y", `calc(50% - ${k}px)`);
        if (map && at) show(map, at, map.getZoom());
      }
      // Story 1389: on a very short screen (320 x 568) the bubble would sit under the top row; with no room it is not shown.
      const tip = r.querySelector(".ui-pinmap-hint")?.getBoundingClientRect(), top = r.querySelector(".ui-pinmap-top")?.getBoundingClientRect();
      setCramped(!!tip && !!top && tip.top < top.bottom + 8);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(r);
    ro.observe(c);
    fit();
    return () => ro.disconnect();
  }, [pick]);
  const strips: Strip[] = kitchen ? (words?.pin && kitchen.pins.includes(words.pin) ? [{ kind: "ready", text: `Inside ${words.pin}` }] : []) : stripsFor({ serve: served, here, pin: point });
  return (
    <section ref={root} className="ui-pinmap" role="region" aria-label="Pin map" data-step={pick ? "details" : "pin"}>
      <div ref={box} className="ui-pinmap-map" role="application" aria-label="Map" />
      <span className="ui-pinmap-pin" data-testid="map-pin" aria-hidden="true">
        <svg viewBox="177 354 60 80"><circle cx="207" cy="400" r="30" fill="var(--md-primary)" opacity="0.14" /><ellipse cx="207" cy="404" rx="7" ry="3" fill="var(--md-on-surface)" opacity="0.3" />
          <path d="M207 360 c-9 0 -15 7 -15 15 c0 11 15 29 15 29 s15 -18 15 -29 c0 -8 -6 -15 -15 -15z" fill="var(--md-primary)" /><circle cx="207" cy="375" r="5" fill="#ffffff" /></svg></span>
      {!moved && !kitchen && !pick && !(search && sOpen) && <p role={cramped ? undefined : "status"} aria-hidden={cramped || undefined} className={cramped ? "ui-pinmap-hint cramped" : "ui-pinmap-hint"}>Move the map to set the pin</p>}   {/* story 1389, board PH1 */}
      <div className="ui-pinmap-top">
        <button type="button" className="ui-pinmap-back" aria-label="Back" onClick={search && sOpen && !pick ? () => { setSOpen(false); setFound(null); setSq(""); } : onBack}>{I(<path d="M19 12H5M11 18l-6-6 6-6" />)}</button>
        {!pick && !kitchen && !(search && sOpen) && <button type="button" className="ui-pinmap-search" aria-label="Search an area or address" onClick={search ? () => setSOpen(true) : onSearch}><span>Search an area or address</span>{I(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>, 20)}</button>}
        {!pick && !kitchen && search && sOpen && <form className="ui-pinmap-search open" onSubmit={(e) => { e.preventDefault(); void runSearch(); }}>
          <input ref={sRef} type="search" role="searchbox" aria-label="Search an area or address" placeholder="Search an area or address" autoFocus value={sq} onChange={(e) => { setSq(e.target.value); setFound(null); }} />
          <ClearCross show={sq !== ""} onClear={() => { setSq(""); setFound(null); }} input={sRef} />
        </form>}
      </div>
      {!pick && search && sOpen && found && <section className="ui-pinmap-results" aria-label="Places">
        {found.state === "busy" && <p className="mono ui-saved-head">Searching…</p>}
        {found.state === "short" && <p className="ui-field-error" role="alert">Type at least 3 letters to search places.</p>}
        {found.state === "error" && <p className="ui-field-error" role="alert">Could not search places. Try again.</p>}
        {found.state === "ok" && found.hits.length === 0 && <p className="ui-row-sub">No place found. Try the start of a colony name or a pin code.</p>}
        <ul className="ui-saved-list">{found.hits.map((h) => <li key={`${h.pin}-${h.name}`} className="ui-saved-row ui-place-row"><button type="button" className="ui-saved-main" onClick={() => take(h)}><span className="ui-saved-label"><span>{h.name}</span><span className={`ui-tag ${h.served ? "ready" : "placed"}`}>{h.served ? "We deliver here" : "Not yet"}</span></span><span className="ui-saved-addr">{h.address}</span></button></li>)}</ul>
      </section>}
      {!pick && <div ref={card} className="ui-pinmap-card">
        <button type="button" className="ui-pinmap-here" onClick={() => void toPhone()}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg><span>Current Location</span></button>
        {kicker && <span className="mono ui-pinmap-kicker">{kicker}</span>}
        <div className="ui-pinmap-place"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.6" fill="#ffffff" /></svg><span className="ui-pinmap-name">{name.name}</span></div>
        {(kitchen ? words?.address : editLine ? `${editLine} · ${name.rest}`.replace(/ · $/, "") : name.rest) && <span className="ui-pinmap-addr">{kitchen ? words?.address : editLine ? `${editLine} · ${name.rest}`.replace(/ · $/, "") : name.rest}</span>}   {/* board A12 repeats the whole address under the name */}
        {failed && <span className="ui-pinmap-addr ui-pinmap-quiet">Could not read the address, the pin still counts</span>}
        {note && <span role="alert" className="ui-pinmap-addr ui-pinmap-quiet">{note}</span>}
        {strips.map((s) => <span key={s.kind} role="status" className={`ui-pinmap-strip ${s.kind}`}>{s.text}</span>)}
        {noAnswer && !kitchen && <span role="status" className="ui-pinmap-strip warn">We could not check this place. Check your internet.</span>}   {/* story 1426, board PE1: yellow, not the red no */}
        {noAnswer && !kitchen ? <button type="button" className="ui-btn big" disabled={busy} aria-busy={busy} onClick={() => { settled.current = null; settle(point); }}>Try again</button> :
        <button type="button" className="ui-btn big" disabled={busy || sending} onClick={() => (onPoint ? onPoint({ at: point, words }) : far ? void invite(far) : setPick({ at: point, words, served: served ? served.serviceable : null }))}>{far ? "Invite the founders here" : confirmLabel}</button>}
        <span className="mono ui-pinmap-credit">{words?.from === "ola" && <><a href={OSM} target="_blank" rel="noopener noreferrer">Ola Maps</a> · </>}<a href={OSM} target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></span>
      </div>}
      {pick && <DetailsSheet pick={pick} edit={edit} draft={draft.current} onDraft={(d) => { draft.current = d; }} onChange={() => setPick(null)} onSave={onSave} onHeight={(h) => { root.current?.style.setProperty("--sheet-h", `${h}px`); live.current?.map.invalidateSize({ pan: false }); const c = pick.at; live.current?.map.setView([c.lat, c.lng], live.current.map.getZoom(), { animate: false }); }} />}
    </section>
  );
}

const CHIPS = ["Home", "Office", "Other"] as const;
// Story #1038 (board C7-PinDetails): the words the rider needs, and the save. The pin's exact place is the one the map rested on.
type Draft = { house: string; landmark: string; chip: (typeof CHIPS)[number]; custom: string };
function DetailsSheet({ pick, edit, draft, onDraft, onChange, onSave, onHeight }: { pick: PinPick; edit?: { label: string; address: string; house?: string | null; landmark?: string | null }; draft: Draft | null; onDraft: (d: Draft) => void; onChange: () => void; onSave: (a: Saved) => void; onHeight: (h: number) => void }) {
  const el = useRef<HTMLElement>(null);
  const tell = useRef(onHeight);
  tell.current = onHeight;
  useEffect(() => {   // the map above keeps exactly the part the sheet leaves free
    const e = el.current;
    if (!e || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => tell.current(e.getBoundingClientRect().height));
    ro.observe(e);
    return () => ro.disconnect();
  }, []);
  const was = edit ? boxOf(edit, pick.words?.address ?? "") : { house: "", landmark: "" };
  const known = edit ? (CHIPS as readonly string[]).includes(edit.label) && edit.label !== "Other" : true;
  const [house, setHouse] = useState(draft?.house ?? was.house);
  const [landmark, setLandmark] = useState(draft?.landmark ?? was.landmark);
  const [chip, setChip] = useState<(typeof CHIPS)[number]>(draft?.chip ?? (edit && known ? (edit.label as (typeof CHIPS)[number]) : edit ? "Other" : "Home"));
  const [custom, setCustom] = useState(draft?.custom ?? (edit && !known ? edit.label : ""));
  useEffect(() => onDraft({ house, landmark, chip, custom }), [house, landmark, chip, custom]);   // onDraft only writes a ref: no render
  const [area, setArea] = useState("");
  const [pinText, setPinText] = useState("");
  const found = (pick.words?.address ?? "").trim();
  const needArea = found === "";
  const needPin = !isPin(pick.words?.pin ?? "");
  const name = cardWords(found || null);
  const label = chip === "Other" ? custom.trim() : chip;
  const pin = needPin ? pinText.trim() : pick.words?.pin ?? "";
  const ready = house.trim().length >= 1 && label.length >= 1 && label.length <= 30 && (!needArea || area.trim().length >= 2) && isPin(pin);   // Save stays asleep until it can work
  const save = () => { if (ready) onSave({ pin, address: addressText(house, landmark, needArea ? area : found), label, from: pick.at, house: house.trim(), landmark: landmark.trim() }); };
  return (
    <section ref={el} className="ui-pinmap-details" role="dialog" aria-label={edit ? "Edit address" : "Address details"}>
      <div className="ui-sheet-head ui-pinmap-details-head"><h2>{edit ? "Edit address" : "Address details"}</h2></div>   {/* 1404 (owner, 13 Nov): no step count on the sheet, on either way in */}
      <div className="ui-pinmap-where">{I(PIN_PATH, 22)}<span className="ui-pinmap-where-words"><b>{name.name}</b>{name.rest && <span>{name.rest}</span>}</span><button type="button" className="ui-pinmap-change" onClick={onChange}>Change</button></div>
      {needArea && <div className="ui-field"><label htmlFor="pd-area">Area or street</label><input id="pd-area" className="ui-eg" type="text" maxLength={200} value={area} onChange={(e) => setArea(e.target.value)} /></div>}
      {needPin && <div className="ui-field"><label htmlFor="pd-pin">Pin code</label><input id="pd-pin" className="mono-input ui-eg" type="tel" inputMode="numeric" maxLength={6} placeholder="e.g. 123456" value={pinText} onChange={(e) => setPinText(e.target.value.trim())} /></div>}
      <div className="ui-field"><label htmlFor="pd-house">House, street, colony, ward</label><input id="pd-house" className="ui-eg" type="text" placeholder="e.g. C-128, Gali 3, Radio Colony" maxLength={120} value={house} onChange={(e) => setHouse(e.target.value)} /></div>
      <div className="ui-field"><label htmlFor="pd-landmark">Landmark (optional)</label><input id="pd-landmark" className="ui-eg" type="text" placeholder="e.g. near the park gate" maxLength={120} value={landmark} onChange={(e) => setLandmark(e.target.value)} /></div>
      <div className="ui-pinmap-saveas"><span className="mono ui-pinmap-kicker">Save as</span>
        <JoinedBar label="Save as" options={CHIPS} value={chip} onPick={setChip} /></div>
      {chip === "Other" && <div className="ui-field"><label htmlFor="pd-name">Name this place</label><input id="pd-name" className="ui-eg" type="text" maxLength={30} value={custom} onChange={(e) => setCustom(e.target.value)} /></div>}
      {!ready && <p role="status" className="ui-reason">{house.trim().length < 1 ? "Add your house or flat number." : needArea && area.trim().length < 2 ? "Add the area or street." : !isPin(pin) ? "Add a 6 digit pin code." : "Choose a name for this place."}</p>}   {/* story #1170 */}
      <button type="button" className="ui-btn big" disabled={!ready} onClick={save}>{edit ? "Save changes" : "Save address"}</button>
    </section>
  );
}
