import { useEffect, useMemo, useState } from 'react';
import { layoutTree, type TreeLayout } from './genealogy';
import type { Family, Person } from '../types';

const empty: TreeLayout = {
  positions: new Map(),
  familyPositions: new Map(),
  familyLanes: new Map(),
  generations: new Map(),
  hasCycles: false,
};

export function useGraphLayout(
  persons: Person[],
  families: Family[],
  signature: string,
  options: Parameters<typeof layoutTree>[2],
) {
  const { cardWidth, cardHeight, density } = options!;
  const key = `${signature}:${cardWidth}:${cardHeight}:${density}`;
  const small = persons.length <= 500;
  const sync = useMemo(
    () => (small ? layoutTree(persons, families, options) : empty),
    [key, small],
  );
  const [result, setResult] = useState({ key: '', layout: empty, error: '' });
  useEffect(() => {
    if (small) return;
    const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
    let active = true;
    worker.onmessage = (event: MessageEvent<{ layout?: TreeLayout; error?: string }>) => {
      if (active)
        setResult({ key, layout: event.data.layout ?? empty, error: event.data.error ?? '' });
    };
    worker.onerror = () => {
      if (active)
        setResult({
          key,
          layout: empty,
          error: 'Ошибка автоматической раскладки. Повторите открытие дерева.',
        });
    };
    worker.postMessage({ persons, families, options });
    return () => {
      active = false;
      worker.terminate();
    };
  }, [key, small]);
  return {
    layout: small ? sync : result.layout,
    pending: !small && result.key !== key,
    layoutError: !small && result.key === key ? result.error : '',
  };
}
