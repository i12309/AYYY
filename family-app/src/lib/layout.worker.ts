import { layoutTree } from './genealogy';
import type { Family, Person } from '../types';

self.onmessage = (
  event: MessageEvent<{
    persons: Person[];
    families: Family[];
    options: Parameters<typeof layoutTree>[2];
  }>,
) => {
  try {
    const { persons, families, options } = event.data;
    self.postMessage({ layout: layoutTree(persons, families, options) });
  } catch {
    self.postMessage({ error: 'Не удалось автоматически расположить дерево.' });
  }
};
