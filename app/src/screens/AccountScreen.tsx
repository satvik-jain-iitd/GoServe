// Account (story D2): the name, phone and address this phone remembers, and a way to change the area.
import { AppBar, Button } from "../ui";

type Props = { name: string; phone: string; address: string; pin: string | null; onBack: () => void; onChangeArea: () => void };

export function AccountScreen({ name, phone, address, pin, onBack, onChangeArea }: Props) {
  const row = (label: string, value: string) => (<><dt>{label}</dt><dd>{value || "Not saved yet"}</dd></>);
  return (
    <section>
      <AppBar title="Account" onBack={onBack} />
      <dl className="metrics" data-testid="account">
        {row("Name", name)}
        {row("Phone", phone)}
        {row("Address", address)}
        {row("Area pin code", pin ?? "")}
      </dl>
      <div className="actions">
        <Button variant="ghost" onClick={onChangeArea}>Change area</Button>
        <Button variant="ghost" onClick={onBack}>Back to menu</Button>
      </div>
    </section>
  );
}
