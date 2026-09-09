'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/Icon';
import { retryExtraction } from '../actions';

// M3 §4.2.6 — ponovni pokušaj nad uvozom koji je pao. Najčešći uzrok neuspeha je prolazan
// (prekid ka provajderu, ograničenje potrošnje); bez ovoga bi čovek morao ponovo da nalepi ceo
// cenovnik, pa bi se u spisku videla dva uvoza za jedan posao.
export default function RetryButton({ importId }: { importId: string }) {
  const [radi, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={radi}
      onClick={() => startTransition(() => retryExtraction(importId))}
    >
      <Icon name="refresh" /> {radi ? 'AI ponovo čita…' : 'Pokušaj ponovo'}
    </Button>
  );
}
