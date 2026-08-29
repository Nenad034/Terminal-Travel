'use client';

import { useEffect, useRef, useState } from 'react';
import { useRowSummary } from '@/components/RowSummaryContext';

const POLL_INTERVAL_MS = 5000;
const FLASH_DURATION_MS = 1500;

interface NodeDefinition {
  id: string;
  label: string;
  matchActions: string[];
}

interface NodeLive {
  id: string;
  label: string;
  count: number;
  capped: boolean;
  lastAt: string | null;
}

// M18 spec §9a — "uživo znači kratak poll, ne push" (bez WebSocket/SSE u tehničkom steku).
// Isti obrazac kao TopBar.tsx Agent Inbox (poll na 30s) — ovde 5s jer je svrha da vlasnik
// stvarno VIDI promenu dok gleda ekran, ne samo da je nađe posle.
//
// Dopuna (29.8.2026, na zahtev vlasnika: "kada se klikne na jednu od stavki u procesnim
// mapama u desnom panelu treba da se prikaze vise detalja") — klik na čvor više ne navigira
// direktno na audit log; puni RowSummaryContext (isti mehanizam kao sažetak reda rezervacije),
// desni panel (RightPanel.tsx → ProcessMapNodeSummaryCard) prikazuje detalj i poslednje zapise.
// Pun audit log ostaje dostupan preko dugmeta u toj kartici, ne gubi se ništa.
export default function ProcessMapView({
  mapKey,
  mapLabel,
  module,
  nodes,
}: {
  mapKey: string;
  mapLabel: string;
  module: string;
  nodes: NodeDefinition[];
}) {
  const { showSummary } = useRowSummary();
  const [live, setLive] = useState<Record<string, NodeLive> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const previousCounts = useRef<Record<string, number>>({});
  const selectedNodeIdRef = useRef<string | null>(null);
  selectedNodeIdRef.current = selectedNodeId;

  function selectNode(node: NodeDefinition, nodeLive: NodeLive | undefined) {
    setSelectedNodeId(node.id);
    showSummary({
      kind: 'process-map-node',
      mapKey,
      mapLabel,
      module,
      nodeId: node.id,
      nodeLabel: node.label,
      matchActions: node.matchActions,
      count: nodeLive?.count ?? 0,
      capped: nodeLive?.capped ?? false,
      lastAt: nodeLive?.lastAt ?? null,
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/ops/process-maps/${mapKey}/live`, { cache: 'no-store' });
        if (cancelled) return;
        if (!res.ok) {
          setError('Procesna mapa trenutno nije dostupna.');
          return;
        }
        const data: { nodes: NodeLive[] } = await res.json();
        setError(null);

        const byId: Record<string, NodeLive> = {};
        const newlyChanged = new Set<string>();
        for (const n of data.nodes) {
          byId[n.id] = n;
          const prev = previousCounts.current[n.id];
          if (prev !== undefined && n.count > prev) newlyChanged.add(n.id);
          previousCounts.current[n.id] = n.count;
        }
        setLive(byId);
        if (newlyChanged.size > 0) {
          setFlashing(newlyChanged);
          setTimeout(() => {
            if (!cancelled) setFlashing(new Set());
          }, FLASH_DURATION_MS);
        }

        // Ako je čvor otvoren u desnom panelu, brojevi tamo prate isti poll — ne gase se
        // dok se ekran gleda, čekaju sledeći klik da promene ceo prikaz.
        const selected = selectedNodeIdRef.current;
        if (selected) {
          const node = nodes.find((n) => n.id === selected);
          const nodeLive = byId[selected];
          if (node) {
            showSummary({
              kind: 'process-map-node',
              mapKey,
              mapLabel,
              module,
              nodeId: node.id,
              nodeLabel: node.label,
              matchActions: node.matchActions,
              count: nodeLive?.count ?? 0,
              capped: nodeLive?.capped ?? false,
              lastAt: nodeLive?.lastAt ?? null,
            });
          }
        }
      } catch {
        if (!cancelled) setError('Procesna mapa trenutno nije dostupna.');
      }
    }

    poll();
    const t = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey]);

  return (
    <div>
      {error && <p className="mb-3 rounded bg-danger-bg p-2 text-xs text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {nodes.map((node) => {
          const nodeLive = live?.[node.id];
          const isFlashing = flashing.has(node.id);
          const isSelected = selectedNodeId === node.id;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => selectNode(node, nodeLive)}
              className={`flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors duration-300 hover:border-accent ${
                isFlashing ? 'border-accent bg-accent-soft' : isSelected ? 'border-accent bg-panel' : 'border-border bg-panel'
              }`}
            >
              <span className="text-xs text-ink-faint">{node.label}</span>
              <span className="font-mono text-2xl font-semibold text-ink">
                {nodeLive ? nodeLive.count : '—'}
                {nodeLive?.capped && <span className="ml-1 text-sm text-warn">+</span>}
              </span>
              <span className="text-[11px] text-ink-faint">
                {nodeLive?.lastAt ? `poslednji: ${new Date(nodeLive.lastAt).toLocaleString('sr-RS')}` : 'nema zapisa u prozoru'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
