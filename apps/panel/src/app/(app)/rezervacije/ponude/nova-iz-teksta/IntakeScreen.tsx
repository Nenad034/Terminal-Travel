'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Icon from '@/components/Icon';
import ActorLabel from '@/components/ActorLabel';
import {
  createDraftQuote,
  extractFromText,
  listSuppliers,
  previewOfficialSite,
  type IntakeResult,
  type SitePreview,
} from './actions';

// M5 spec §3.0j / M17 (v2.53) — „Nova ponuda iz teksta". Levo: lepljenje i potpitanja. Desno:
// forma predloga sa oznakom odakle je svako polje (tekst / katalog / prazno) i upozorenjima.
// Dole: „Napravi nacrt ponude" — JEDINI upis; sve pre toga je čitanje i predlog. Čovek sme da
// ispravi svako polje pre klika — to je gejt „AI predlaže, čovek odobrava" (M15 §7).

const BOARD_LABEL: Record<string, string> = {
  RO: 'samo noćenje',
  BB: 'noćenje sa doručkom',
  HB: 'polupansion',
  FB: 'pun pansion',
  AI: 'all inclusive',
  UAI: 'ultra all inclusive',
};

const KIND_LABEL = {
  SUPPLIER_OFFER: 'ponuda dobavljača — cena je NABAVNA',
  CLIENT_REQUEST: 'zahtev klijenta — iznos je BUDŽET (predlog izlazne cene)',
  UNCLEAR: 'nije jasno ko piše — proverite ulogu cene',
};

function minorToInput(minor: number | null): string {
  return minor === null ? '' : (minor / 100).toFixed(2);
}
function inputToMinor(v: string): number | null {
  const t = v.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

interface Form {
  name: string;
  city: string;
  country: string;
  stayFrom: string;
  stayTo: string;
  adults: number;
  childrenAges: string;
  board: string;
  baseCost: string;
  finalPrice: string;
  currency: string;
  supplierId: string;
  notes: string;
  useCatalogProduct: boolean;
  officialUrl: string;
  saveToCatalog: boolean;
  description: string;
}

export default function IntakeScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [answerDraft, setAnswerDraft] = useState('');
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [site, setSite] = useState<SitePreview | null>(null);
  const [siteAccepted, setSiteAccepted] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listSuppliers().then(setSuppliers);
  }, []);

  function run(extraAnswers: string[]) {
    setError(null);
    startTransition(async () => {
      const r = await extractFromText(text, extraAnswers);
      if (r.error || !r.result) {
        setError(r.error ?? 'Greška.');
        return;
      }
      setResult(r.result);
      const e = r.result.extraction;
      const d = r.result.derived;
      const m = r.result.match;
      setForm({
        name:
          m.productId && m.matchScore !== null && m.matchScore >= 85
            ? (m.productName ?? '')
            : (e.property_name ?? ''),
        city: e.city ?? '',
        country: e.country ?? '',
        stayFrom: d.stayFrom ?? '',
        stayTo: d.stayTo ?? '',
        adults: d.adults || 2,
        childrenAges: e.rooms.flatMap((x) => x.children_ages).join(', '),
        board: e.board ?? '',
        baseCost: d.priceRole === 'BASE_COST' ? minorToInput(d.amountMinor) : '',
        finalPrice: d.priceRole === 'FINAL_PRICE' ? minorToInput(d.amountMinor) : '',
        currency: d.currency ?? 'EUR',
        supplierId: m.supplierId ?? '',
        notes: e.notes ?? '',
        useCatalogProduct: Boolean(m.productId && m.hasPriceForPeriod),
        officialUrl: '',
        saveToCatalog: false,
        description: '',
      });
      setSite(null);
      setSiteAccepted(false);
    });
  }

  function answerAndRerun() {
    const a = answerDraft.trim();
    if (!a) return;
    const next = [...answers, a];
    setAnswers(next);
    setAnswerDraft('');
    run(next);
  }

  async function pullSite() {
    if (!form?.officialUrl) return;
    setSiteError(null);
    const r = await previewOfficialSite(form.officialUrl);
    if (r.error || !r.preview) {
      setSiteError(r.error ?? 'Greška.');
      return;
    }
    setSite(r.preview);
    setSiteAccepted(false);
  }

  async function create() {
    if (!form || !result) return;
    setError(null);
    setCreating(true);
    const childrenAges = form.childrenAges
      .split(/[,\s]+/)
      .map((x) => Number(x))
      .filter((n) => Number.isInteger(n) && n >= 0);
    const finalMinor = inputToMinor(form.finalPrice);
    const baseMinor = inputToMinor(form.baseCost);
    const useCatalog = form.useCatalogProduct && result.match.productId;
    if (!useCatalog) {
      if (!form.supplierId) {
        setError('Izaberite dobavljača — ručna stavka bez dobavljača ne može (M5 §6.7b).');
        setCreating(false);
        return;
      }
      if (finalMinor === null) {
        setError('Unesite izlaznu cenu (ukupno za boravak).');
        setCreating(false);
        return;
      }
    }
    const r = await createDraftQuote({
      intakeSourceText: text,
      stayFrom: form.stayFrom,
      stayTo: form.stayTo,
      adults: form.adults,
      childrenAges,
      notes: form.notes || null,
      productId: useCatalog ? result.match.productId : null,
      rateLineId: null,
      manual: useCatalog
        ? null
        : {
            name: form.name,
            description:
              siteAccepted && site?.description ? site.description : form.description || null,
            supplierId: form.supplierId,
            destinationCountry: form.country || '—',
            destinationCity: form.city || '—',
            baseCost: baseMinor,
            finalPrice: finalMinor as number,
            currency: form.currency || 'EUR',
            saveToCatalog: form.saveToCatalog,
            attributes:
              siteAccepted && site
                ? {
                    stars: site.stars,
                    address: site.address,
                    amenities: site.amenities,
                    official_site: site.url,
                    source: 'OFFICIAL_SITE_AI_APPROVED',
                  }
                : null,
          },
    });
    setCreating(false);
    if (r.error || !r.quoteId) {
      setError(r.error ?? 'Greška.');
      return;
    }
    router.push(`/rezervacije/ponude/${r.quoteId}`);
  }

  const upd = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const questions = result?.extraction.questions ?? [];
  const canCreate = Boolean(
    form && form.stayFrom && form.stayTo && form.name && questions.length === 0,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Levo — ulaz */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-panel p-4">
        <label htmlFor="intake-text" className="text-xs font-semibold text-ink">
          Nalepite mejl dobavljača ili zahtev klijenta
        </label>
        <textarea
          id="intake-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder={
            'npr. Za Hotel X u Budvi, 20–27.6.2027, 2 odrasla + 1 dete (6), polupansion, 1.240 EUR ukupno. Ponuda važi do 30.9.'
          }
          className="w-full rounded border border-border bg-bg p-2 text-sm text-ink placeholder:text-ink-faint"
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setAnswers([]);
              run([]);
            }}
            disabled={pending || text.trim().length < 10}
          >
            {pending ? 'Čitam…' : 'Pročitaj tekst'}
          </Button>
          <span className="text-[11px] text-ink-faint">
            <ActorLabel name="AI samo čita" origin="AI_AGENT" /> · ništa se ne upisuje pre vašeg
            klika desno
          </span>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}

        {questions.length > 0 && (
          <div className="rounded-lg border border-accent-strong/40 bg-bg p-3 text-xs">
            <p className="mb-1 font-semibold text-ink">
              <Icon name="question" /> Nedostaje podatak:
            </p>
            <ul className="mb-2 list-disc pl-4 text-ink">
              {questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            {answers.length >= 2 ? (
              <p className="text-ink-faint">
                Dva kruga pitanja su potrošena (M15 §6.5.4.6) — dopunite polja desno ručno.
              </p>
            ) : (
              <div className="flex gap-2">
                <input
                  id="intake-answer"
                  value={answerDraft}
                  onChange={(e) => setAnswerDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && answerAndRerun()}
                  placeholder="odgovor…"
                  className="h-8 flex-1 rounded border border-border bg-panel px-2 text-ink"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={answerAndRerun}
                  disabled={pending}
                >
                  odgovori
                </Button>
              </div>
            )}
          </div>
        )}
        {answers.length > 0 && (
          <p className="text-[11px] text-ink-faint">Vaši odgovori: {answers.join(' · ')}</p>
        )}
      </section>

      {/* Desno — predlog */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-panel p-4">
        {!form || !result ? (
          <p className="py-8 text-center text-sm text-ink-dim">
            Predlog se pojavljuje ovde posle čitanja teksta — svako polje sa oznakom odakle je.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Predlog nacrta</h2>
              <span className="text-[11px] text-ink-faint">
                {KIND_LABEL[result.extraction.kind]} · pouzdanost {result.extraction.confidence}
              </span>
            </div>

            {result.warnings.length > 0 && (
              <ul className="rounded-lg border border-warn bg-warn-bg p-2 text-xs text-warn">
                {result.warnings.map((w) => (
                  <li key={w}>
                    <Icon name="warning" /> {w}
                  </li>
                ))}
              </ul>
            )}

            {/* Objekat */}
            <div className="rounded-lg border border-border bg-bg p-3 text-xs">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink">Objekat</span>
                {result.match.productId ? (
                  <span className="text-ink-faint">
                    iz kataloga: <b className="text-ink">{result.match.productName}</b> (sličnost{' '}
                    {result.match.matchScore} %){' '}
                    {result.match.hasPriceForPeriod
                      ? '· ima ugovorenu cenu za period'
                      : '· bez cene za taj period'}
                  </span>
                ) : (
                  <span className="text-ink-faint">
                    nema ga u katalogu → ručna stavka (DRAFT proizvod)
                  </span>
                )}
              </div>
              {result.match.productId && result.match.hasPriceForPeriod && (
                <label className="mb-2 flex items-center gap-2 text-ink">
                  <input
                    type="checkbox"
                    checked={form.useCatalogProduct}
                    onChange={(e) => upd({ useCatalogProduct: e.target.checked })}
                  />
                  koristi NAŠU ugovorenu cenu iz kataloga (cena iz teksta samo za poređenje)
                </label>
              )}
              <div className="grid grid-cols-3 gap-2">
                <Polje label="naziv" src={result.extraction.property_name ? 'tekst' : null}>
                  <input
                    value={form.name}
                    onChange={(e) => upd({ name: e.target.value })}
                    className={inp}
                  />
                </Polje>
                <Polje label="mesto" src={result.extraction.city ? 'tekst' : null}>
                  <input
                    value={form.city}
                    onChange={(e) => upd({ city: e.target.value })}
                    className={inp}
                  />
                </Polje>
                <Polje label="država" src={result.extraction.country ? 'tekst' : null}>
                  <input
                    value={form.country}
                    onChange={(e) => upd({ country: e.target.value })}
                    className={inp}
                  />
                </Polje>
              </div>
            </div>

            {/* Boravak */}
            <div className="grid grid-cols-4 gap-2 rounded-lg border border-border bg-bg p-3 text-xs">
              <Polje
                label="od"
                src={
                  result.extraction.stay_from
                    ? 'tekst'
                    : result.derived.stayFrom
                      ? 'izvedeno'
                      : null
                }
              >
                <input
                  type="date"
                  value={form.stayFrom}
                  onChange={(e) => upd({ stayFrom: e.target.value })}
                  className={inp}
                />
              </Polje>
              <Polje
                label="do"
                src={
                  result.extraction.stay_to ? 'tekst' : result.derived.stayTo ? 'izvedeno' : null
                }
              >
                <input
                  type="date"
                  value={form.stayTo}
                  onChange={(e) => upd({ stayTo: e.target.value })}
                  className={inp}
                />
              </Polje>
              <Polje label="odrasli" src={result.derived.adults ? 'tekst' : null}>
                <input
                  type="number"
                  min={1}
                  value={form.adults}
                  onChange={(e) => upd({ adults: Number(e.target.value) })}
                  className={inp}
                />
              </Polje>
              <Polje label="deca (uzrasti)" src={result.derived.children ? 'tekst' : null}>
                <input
                  value={form.childrenAges}
                  onChange={(e) => upd({ childrenAges: e.target.value })}
                  placeholder="npr. 5, 9"
                  className={inp}
                />
              </Polje>
              <Polje label="usluga" src={result.extraction.board ? 'tekst' : null}>
                <select
                  value={form.board}
                  onChange={(e) => upd({ board: e.target.value })}
                  className={inp}
                >
                  <option value="">—</option>
                  {Object.entries(BOARD_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Polje>
              <Polje
                label="napomena (uslovi iz teksta)"
                src={result.extraction.notes ? 'tekst' : null}
                span={3}
              >
                <input
                  value={form.notes}
                  onChange={(e) => upd({ notes: e.target.value })}
                  className={inp}
                />
              </Polje>
            </div>

            {/* Cena i dobavljač — samo ručna stavka */}
            {!(form.useCatalogProduct && result.match.productId) && (
              <div className="grid grid-cols-4 gap-2 rounded-lg border border-border bg-bg p-3 text-xs">
                <Polje
                  label="nabavna (ukupno)"
                  src={result.derived.priceRole === 'BASE_COST' ? 'tekst' : null}
                >
                  <input
                    value={form.baseCost}
                    onChange={(e) => upd({ baseCost: e.target.value })}
                    placeholder="prazno = još nije dogovorena"
                    className={inp}
                  />
                </Polje>
                <Polje
                  label="izlazna (ukupno)"
                  src={result.derived.priceRole === 'FINAL_PRICE' ? 'tekst (budžet)' : null}
                >
                  <input
                    value={form.finalPrice}
                    onChange={(e) => upd({ finalPrice: e.target.value })}
                    className={inp}
                  />
                </Polje>
                <Polje label="valuta" src={result.derived.currency ? 'tekst' : null}>
                  <input
                    value={form.currency}
                    onChange={(e) => upd({ currency: e.target.value })}
                    className={inp}
                  />
                </Polje>
                <Polje label="dobavljač" src={result.match.supplierId ? 'katalog' : null}>
                  <select
                    value={form.supplierId}
                    onChange={(e) => upd({ supplierId: e.target.value })}
                    className={inp}
                  >
                    <option value="">— izaberite —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Polje>
                {form.baseCost && form.finalPrice && (
                  <p className="col-span-4 text-ink-faint">
                    marža:{' '}
                    <b className="text-ink">
                      {(
                        ((inputToMinor(form.finalPrice) ?? 0) -
                          (inputToMinor(form.baseCost) ?? 0)) /
                        100
                      ).toFixed(2)}{' '}
                      {form.currency}
                    </b>
                  </p>
                )}
                {result.match.supplierCandidates.length > 1 && !result.match.supplierId && (
                  <p className="col-span-4 text-ink-faint">
                    Više dobavljača liči na &bdquo;{result.extraction.supplier_name}&ldquo;:{' '}
                    {result.match.supplierCandidates.map((c) => c.name).join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Zvaničan sajt + katalog — samo ručna stavka (§3.0j.7 t. 3) */}
            {!(form.useCatalogProduct && result.match.productId) && (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3 text-xs">
                <label className="flex items-center gap-2 text-ink">
                  <input
                    type="checkbox"
                    checked={form.saveToCatalog}
                    onChange={(e) => upd({ saveToCatalog: e.target.checked })}
                  />
                  sačuvaj hotel u katalog (ACTIVE) — inače ostaje nacrt vidljiv samo na ovoj ponudi
                </label>
                <div className="flex gap-2">
                  <input
                    value={form.officialUrl}
                    onChange={(e) => upd({ officialUrl: e.target.value })}
                    placeholder="link zvaničnog sajta hotela (https://…) — AI povlači opis, adresu, kategoriju; vi odobravate"
                    className={`${inp} flex-1`}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={pullSite}
                    disabled={!form.officialUrl}
                  >
                    povuci sa sajta
                  </Button>
                </div>
                {siteError && <p className="text-danger">{siteError}</p>}
                {site && (
                  <div className="rounded border border-dashed border-border p-2">
                    <p className="mb-1 text-ink-faint">
                      <ActorLabel name="AI predlog sa sajta" origin="AI_AGENT" /> {site.url}
                    </p>
                    <p className="text-ink">
                      {site.stars ? `${'★'.repeat(site.stars)} · ` : ''}
                      {site.address ?? 'adresa nije nađena'}
                    </p>
                    <p className="mt-1 text-ink">{site.description ?? '(bez opisa)'}</p>
                    {site.amenities.length > 0 && (
                      <p className="mt-1 text-ink-faint">{site.amenities.join(' · ')}</p>
                    )}
                    <label className="mt-2 flex items-center gap-2 font-semibold text-ink">
                      <input
                        type="checkbox"
                        checked={siteAccepted}
                        onChange={(e) => setSiteAccepted(e.target.checked)}
                      />
                      odobravam — upiši ovo u proizvod
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button type="button" onClick={create} disabled={!canCreate || creating}>
                {creating ? 'Pravim…' : 'Napravi nacrt ponude →'}
              </Button>
              <span className="text-[11px] text-ink-faint">
                Nacrt ostaje DRAFT; dalje ide kao svaka ponuda (deljenje, potvrda).
              </span>
            </div>
          </>
        )}
      </section>
      <p className="text-[11px] text-ink-faint lg:col-span-2">
        <Link href="/rezervacije/pretraga" className="text-accent-strong hover:underline">
          ← nazad na pretragu
        </Link>
      </p>
    </div>
  );
}

const inp =
  'h-8 w-full rounded border border-border bg-panel px-2 text-xs text-ink placeholder:text-ink-faint';

function Polje({
  label,
  src,
  span,
  children,
}: {
  label: string;
  src: 'tekst' | 'katalog' | 'izvedeno' | 'tekst (budžet)' | null;
  span?: number;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-0.5 ${span ? `col-span-${span}` : ''}`}>
      <span className="text-[11px] text-ink-faint">
        {label}
        {src ? (
          <span className="ml-1 rounded bg-sunken px-1 text-[10px] text-ink-dim">{src}</span>
        ) : (
          <span className="ml-1 rounded bg-warn-bg px-1 text-[10px] text-warn">prazno</span>
        )}
      </span>
      {children}
    </label>
  );
}
