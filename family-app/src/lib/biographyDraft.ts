export interface BiographyDraft {
  biography: string;
  format: 'text' | 'markdown';
  revision: number;
  savedAt: string;
}
export function biographyDraftKey(treeId: string, personId: string) {
  return `gen:biography-draft:v1:${treeId}:${personId}`;
}
export function readBiographyDraft(treeId: string, personId: string): BiographyDraft | null {
  const key = biographyDraftKey(treeId, personId);
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    return value &&
      typeof value.biography === 'string' &&
      value.biography.length <= 1_000_000 &&
      ['text', 'markdown'].includes(value.format) &&
      Number.isInteger(value.revision) &&
      typeof value.savedAt === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveBiographyDraft(treeId: string, personId: string, draft: BiographyDraft) {
  localStorage.setItem(biographyDraftKey(treeId, personId), JSON.stringify(draft));
}
export function removeBiographyDraft(treeId: string, personId: string) {
  localStorage.removeItem(biographyDraftKey(treeId, personId));
}
