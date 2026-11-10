import type { Family, Person } from '../types';

/** Compact deterministic fingerprint for geometry/preferences, not a security hash. */
export function structuralSignature(persons: Person[], families: Family[]): string {
  let hash = 2166136261;
  const add = (text: string) => {
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    hash = Math.imul(hash ^ 0, 16777619);
  };
  for (const person of persons) add(person.id);
  for (const family of families) {
    add(family.id);
    add(family.partner1_id ?? '');
    add(family.partner2_id ?? '');
    for (const child of family.children) add(child.person_id);
  }
  return `${persons.length}-${families.length}-${(hash >>> 0).toString(36)}`;
}

export function saveLayout(key: string, positions: unknown, treeId: string): void {
  const prefix = `gen:graph-layout:v4:${treeId}:`;
  // Access order is stored separately; only manually dragged coordinates are persisted.
  const indexKey = `gen:graph-layout:index:${treeId}`;
  const raw: unknown = JSON.parse(localStorage.getItem(indexKey) ?? '[]');
  const index = (Array.isArray(raw) ? raw : []).filter(
    (value): value is string =>
      typeof value === 'string' && value.startsWith(prefix) && value !== key,
  );
  index.push(key);
  while (index.length > 25) localStorage.removeItem(index.shift()!);
  for (const old of Object.keys(localStorage)) {
    if (old.startsWith(`gen:graph-layout:v3:${treeId}:`)) localStorage.removeItem(old);
  }
  localStorage.setItem(key, JSON.stringify(positions));
  localStorage.setItem(indexKey, JSON.stringify(index));
}

export function cleanLegacyLayouts(treeId: string): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(`gen:graph-layout:v3:${treeId}:`)) localStorage.removeItem(key);
  }
}
