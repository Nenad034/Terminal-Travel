import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';


// Dopuna (23.8.2026, na zahtev vlasnika: "kada se klikne na + ... treba da se otvori prazan
// tab a mi cemo tu dalje da odlucimo sta cemo da radimo") — jedna statična, bez-stanja ruta.
// Više klikova na "+" otvara više zapisa sa OVOM istom putanjom (TabBar.tsx, `openTab(...,
// { forceNew: true })`) — razlikuju se isključivo preko `TabsContext` `id`-ja, ne preko URL-a,
// pa svaka instanca ostaje sopstveni, zaseban tab u traci iako sve vode ovde.
export default function BlankTabPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-faint">
      <RegisterTab label="Novi tab" />
      <Icon name="add" className="!text-[32px]" />
      <p className="text-sm">Prazan tab — otvori nešto iz leve trake, komandne palete (Ctrl K) ili terminala.</p>
    </div>
  );
}
