// /styleguide (story D1): every component once, with demo data. Shown only in builds made with VITE_STYLEGUIDE=1.
import { useState, type ReactNode } from "react";
import { AppBar, Button, Chip, Empty, Sheet, Skeleton, Stepper, StickyBar, Tile, Timeline } from "./index";

const Block = ({ name, children }: { name: string; children: ReactNode }) => (
  <section data-testid={`sg-${name}`} style={{ marginBottom: "var(--gs-space-6)" }}>
    <h2>{name}</h2>
    {children}
  </section>
);

export function Styleguide() {
  const [qty, setQty] = useState(1);
  const [veg, setVeg] = useState(true);
  const [open, setOpen] = useState(false);
  return (
    <main className="shell">
      <h1>Styleguide</h1>
      <Block name="AppBar"><AppBar title="Menu" onBack={() => undefined} /></Block>
      <Block name="Tile"><Tile title="Dal Makhani" meta="Hauz Khas Kitchen" price="₹220" veg><Button>Add</Button></Tile></Block>
      <Block name="Chip"><Chip selected={veg} onClick={() => setVeg(!veg)}>Veg only</Chip></Block>
      <Block name="Stepper"><Stepper label="Demo dish" value={qty} onChange={setQty} /></Block>
      <Block name="StickyBar"><p className="ui-meta">Sticks to the bottom of the screen.</p></Block>
      <Block name="Timeline"><Timeline steps={["Placed", "Cooking", "On the way", "Delivered"]} current={1} /></Block>
      <Block name="Sheet"><Button onClick={() => setOpen(true)}>Open sheet</Button></Block>
      <Block name="Button"><Button>Primary</Button> <Button variant="ghost">Ghost</Button></Block>
      <Block name="Empty"><Empty title="No orders yet" hint="Pick a dish to start." /></Block>
      <Block name="Skeleton"><Skeleton lines={3} /></Block>
      <StickyBar><Button>View cart · ₹220</Button></StickyBar>
      <Sheet open={open} title="Demo sheet" onClose={() => setOpen(false)}>A sheet slides up over the page.</Sheet>
    </main>
  );
}
