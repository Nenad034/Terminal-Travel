'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from './Icon';
import { describeRooms, parseRooms } from '@/lib/search-rooms';
import { findIconByTypes } from '@/lib/search-product-types';
import { SAVED_VIEWS_CHANGED_EVENT, type SavedView } from './SavedViewsSidebarPanel';
import { useGroupSearchBuilder } from './GroupSearchBuilderContext';

const PREFERENCE_KEY = 'saved_views.rezervacije_pretraga';
const MAX_SAVED_SEARCHES = 10;
const GROUP_PREFERENCE_KEY = 'saved_views.rezervacije_grupna_pretraga';
const MAX_SAVED_GROUPS = 10;
const MAX_SEARCHES_PER_GROUP = 6;

export interface SavedGroupSearch {
  id: string;
  name: string;
  searches: { label: string; filters: Record<string, string | string[]> }[];
}

function newViewId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `v${Date.now()}${Math.random()}`;
}

// SKUPLJEN RED PRETRAGE (M5 spec §3.0g.2 / dizajn dok. §6d.1). Čim rezultati stignu, forma se
// skuplja u ovaj jedan red — ali red MORA i dalje čitko prikazivati kriterijume. Skupljanje na
// golo "+" je specifikacijom izričito ZABRANJENO: agent je u tom trenutku na telefonu sa gostom
// i najčešće pitanje koje dobija je "šta ste ono uneli"; ekran koji to sakriva tera ga da otvara
// formu samo da bi pročitao sopstveni upit.
//
// Uz kriterijume stoje dve radnje iz §3.0g.2 — "Poništi pretragu" (briše kriterijume i rezultate
// SAMO ove vrste proizvoda, ne dira ostale ni desni panel, §3.0g.4) i "Osveži podatke" (§3.0g.3,
// ponavlja isti upit i PRIJAVLJUJE razliku umesto da tiho zameni cenu) — plus ranije dogovoreni
// "sačuvaj" i "dodaj u grupu", koji ostaju nepromenjeni.
//
// Dugme "Sačuvaj" (26.8.2026, na zahtev vlasnika: "omogućite čuvanje filtera pretrage kako bi
// se vratili po želji, max 10 pretraga") — isti mehanizam/`UserPreference` ključ kao "Sačuvaj
// pretragu" na listi rezervacija (BookingsListClient.tsx), ovde uz gornju granicu. Ponovno
// otvaranje sačuvane pretrage (SavedViewsSidebarPanel u levom panelu) je PRAVA navigacija — nov
// `GET /sales/search` poziv, cena/dostupnost se time UVEK proveravaju iznova, nikad se ne
// prikazuje stara sačuvana cena.
//
// Naziv se generiše SAM (dopuna, na zahtev vlasnika: "naziv sačuvanog filtera treba sam da se
// generiše iz odabranih filtera") — isti sažetak koji već piše na samom chip-u (tip · destinacija
// · datumi · broj osoba), bez posebnog polja za kucanje/popover-a — jedan klik čuva.
export default function SearchCriteriaChip({
  onExpand,
  onReset,
  onRefresh,
  refreshing,
}: {
  /** Otvara ugrađenu formu u centralnom panelu (SearchPanel.tsx) — zamena za nekadašnji popup. */
  onExpand: () => void;
  onReset: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const sp = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const { staged, stage, unstage, clear: clearStaged } = useGroupSearchBuilder();

  const types = sp.getAll('type');
  if (types.length === 0) return null; // nema aktivne pretrage — nema šta da se sažme

  const icon = findIconByTypes(types);
  const label = icon?.label ?? types.join(', ');
  const destination = [sp.get('destinationCity'), sp.get('destinationCountry')].filter(Boolean).join(', ');
  const dates = sp.get('stayFrom') && sp.get('stayTo') ? `${sp.get('stayFrom')} – ${sp.get('stayTo')}` : null;
  // Sobe se prikazuju sa uzrastima kad postoje (§3.2a) — „2 sobe · 4 odr. + 1 dete (7)";
  // starije pretrage bez `rooms` ostaju na zbirnim brojevima, isti tekst kao ranije.
  const occupancy = sp.get('rooms')
    ? describeRooms(parseRooms(sp.get('rooms')))
    : `${sp.get('adults') ?? '2'} odr.${Number(sp.get('children') ?? '0') > 0 ? ` + ${sp.get('children')} dece` : ''}`;
  const autoName = [label, destination || null, dates, occupancy].filter(Boolean).join(' · ');

  function currentFilters(): Record<string, string | string[]> {
    const filters: Record<string, string | string[]> = {};
    sp.forEach((value, key) => {
      const existingValue = filters[key];
      if (existingValue === undefined) filters[key] = value;
      else if (Array.isArray(existingValue)) existingValue.push(value);
      else filters[key] = [existingValue, value];
    });
    return filters;
  }

  async function saveSearch() {
    setSaving(true);
    setSaveError(null);
    try {
      const filters = currentFilters();
      const res = await fetch('/api/preferences', { cache: 'no-store' });
      const data = res.ok ? await res.json() : {};
      const existing: SavedView[] = Array.isArray(data[PREFERENCE_KEY]) ? data[PREFERENCE_KEY] : [];
      if (existing.length >= MAX_SAVED_SEARCHES) {
        setSaveError(`Najviše ${MAX_SAVED_SEARCHES} sačuvanih pretraga — obriši neku u levom panelu pre čuvanja nove.`);
        return;
      }
      const next = [...existing, { id: newViewId(), name: autoName, filters }];
      await fetch(`/api/preferences/${PREFERENCE_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next }),
      });
      window.dispatchEvent(new Event(SAVED_VIEWS_CHANGED_EVENT));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  // M5 spec v1.82 (29.8.2026) — "dodaj u grupu" stavlja TRENUTNU pretragu u sesijsko stanje
  // (GroupSearchBuilderContext, mora živeti iznad ove stranice jer je ona server komponenta i
  // gubi lokalni state pri svakoj promeni query stringa). Naziv se generiše isto kao pojedinačna
  // pretraga (autoName) — isti razlog kao gore, jedan klik, bez kucanja.
  function stageCurrent() {
    setGroupError(null);
    if (staged.length >= MAX_SEARCHES_PER_GROUP) {
      setGroupError(`Najviše ${MAX_SEARCHES_PER_GROUP} pretraga po grupi.`);
      return;
    }
    stage({ id: newViewId(), label: autoName, filters: currentFilters() });
  }

  async function saveGroup() {
    setSavingGroup(true);
    setGroupError(null);
    try {
      const res = await fetch('/api/preferences', { cache: 'no-store' });
      const data = res.ok ? await res.json() : {};
      const existing: SavedGroupSearch[] = Array.isArray(data[GROUP_PREFERENCE_KEY]) ? data[GROUP_PREFERENCE_KEY] : [];
      if (existing.length >= MAX_SAVED_GROUPS) {
        setGroupError(`Najviše ${MAX_SAVED_GROUPS} sačuvanih grupa — obriši neku u levom panelu pre čuvanja nove.`);
        return;
      }
      const groupName = staged.map((s) => s.label.split(' · ')[0]).join(' + ');
      const next = [...existing, { id: newViewId(), name: groupName, searches: staged.map((s) => ({ label: s.label, filters: s.filters })) }];
      await fetch(`/api/preferences/${GROUP_PREFERENCE_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next }),
      });
      window.dispatchEvent(new Event(SAVED_VIEWS_CHANGED_EVENT));
      clearStaged();
    } finally {
      setSavingGroup(false);
    }
  }

  return (
    <>
      {/* Dve grupe u istom redu (dopuna 3.9.2026, na zahtev vlasnika: „od + pa desno sve stavke
          postavite do desne ivice kako bi razdvojili od teksta koji objašnjava koja je pretraga
          u pitanju") — levo ŠTA je pretraženo, desno ŠTA se sa tim može uraditi. Razdvaja ih
          `ml-auto` na desnoj grupi, ne fiksni razmak: red je pun širine panela, pa bi svaka
          fiksna vrednost bila tačna samo na jednoj širini prozora.
          Obe grupe su i same `flex-wrap` — na uskom prozoru se radnje prelome u svoj red umesto
          da razvuku red u jednu nečitku traku. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs text-ink">
        <div className="flex flex-wrap items-center gap-2">
          <Icon name={icon?.icon ?? 'search'} className="text-accent-strong" />
          <span className="font-semibold">{label}</span>
          {destination && <span className="text-ink-dim">· {destination}</span>}
          {dates && <span className="text-ink-dim">· {dates}</span>}
          <span className="text-ink-dim">· {occupancy}</span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          onClick={onExpand}
          title="Otvori formu pretrage"
          className="flex items-center gap-1 rounded border border-accent px-1.5 text-accent-strong hover:bg-accent hover:text-accent-ink"
        >
          <Icon name="add" />
        </button>
        <button onClick={onReset} title="Briše kriterijume i rezultate SAMO ove vrste proizvoda" className="flex items-center gap-1 text-ink-dim hover:text-danger">
          <Icon name="clear-all" /> poništi pretragu
        </button>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          title="Ponavlja isti upit i prijavljuje šta se promenilo (M5 §3.0g.3)"
          className="flex items-center gap-1 text-accent-strong hover:underline disabled:opacity-50"
        >
          <Icon name="refresh" /> {refreshing ? 'osvežavam…' : 'osveži podatke'}
        </button>
        <div className="relative">
          <button
            onClick={saveSearch}
            disabled={saving}
            title={`Sačuva se kao "${autoName}"`}
            className="flex items-center gap-1 text-accent-strong hover:underline disabled:opacity-50"
          >
            <Icon name={justSaved ? 'check' : 'bookmark'} /> {justSaved ? 'sačuvano' : saving ? '…' : 'sačuvaj'}
          </button>
          {/* Poruka se poravnava po DESNOJ ivici dugmeta (dopuna 3.9.2026) — otkako radnje stoje
              uz desnu ivicu panela, `left-0` bi je gurnuo van vidljivog dela. */}
          {saveError && (
            <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-danger bg-panel p-2 text-[11px] text-danger shadow-lg">
              {saveError}
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={stageCurrent}
            title="Dodaj ovu pretragu u grupnu pretragu (npr. let + hotel + transfer za isto putovanje)"
            className="flex items-center gap-1 text-accent-strong hover:underline"
          >
            <Icon name="layers" /> dodaj u grupu
          </button>
          {groupError && (
            <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-danger bg-panel p-2 text-[11px] text-danger shadow-lg">
              {groupError}
            </div>
          )}
        </div>
        </div>
      </div>

      {staged.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-panel p-2 text-xs text-ink-dim">
          <span className="font-medium text-ink-faint">Grupna pretraga u izgradnji:</span>
          {staged.map((s) => (
            <span key={s.id} className="flex items-center gap-1 rounded-full bg-panel2 px-2 py-1 text-[11px]">
              {s.label.split(' · ')[0]}
              <button onClick={() => unstage(s.id)} title="Ukloni iz grupe" className="text-ink-faint hover:text-danger">
                <Icon name="close" />
              </button>
            </span>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={clearStaged} className="text-ink-faint hover:text-danger">
              otkaži
            </button>
            <button
              onClick={saveGroup}
              disabled={savingGroup || staged.length < 2}
              title={staged.length < 2 ? 'Dodaj bar dve pretrage pre čuvanja grupe' : 'Sačuvaj grupu'}
              className="flex items-center gap-1 rounded bg-accent px-2 py-1 font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
            >
              <Icon name="bookmark" /> {savingGroup ? '…' : `sačuvaj grupu (${staged.length})`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
