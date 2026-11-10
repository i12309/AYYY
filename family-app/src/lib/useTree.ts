import { useCallback, useEffect, useRef, useState } from 'react';
import type { Family, Person, TreeData, TreeSummary } from '../types';
import { api, errorMessage } from './api';

export function useTree(treeId: string | null) {
  const [data, setData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const currentTree = useRef(treeId);
  currentTree.current = treeId;

  const refresh = useCallback(async () => {
    if (!treeId) return;
    const ticket = ++generation.current;
    const next = await api<TreeData>(`/trees/${treeId}`);
    if (ticket === generation.current && currentTree.current === treeId) {
      setData(next);
      setError('');
    }
  }, [treeId]);

  useEffect(() => {
    setData(null);
    setError('');
    if (!treeId) return;
    const controller = new AbortController();
    const ticket = ++generation.current;
    setLoading(true);
    api<TreeData>(`/trees/${treeId}`, { signal: controller.signal })
      .then((next) => {
        if (ticket === generation.current) setData(next);
      })
      .catch((err) => {
        if (!controller.signal.aborted && ticket === generation.current)
          setError(errorMessage(err));
      })
      .finally(() => {
        if (ticket === generation.current) setLoading(false);
      });
    return () => controller.abort();
  }, [treeId]);

  const updateData = useCallback(
    (update: (current: TreeData) => TreeData) => {
      if (currentTree.current !== treeId) return;
      // Ignore a full GET started before this mutation response.
      ++generation.current;
      setData((current) => (current?.tree.id === treeId ? update(current) : current));
    },
    [treeId],
  );
  const replacePerson = useCallback(
    async (person: Person) => {
      updateData((current) => ({
        ...current,
        persons: current.persons.map((previous) =>
          previous.id === person.id && previous.revision <= person.revision ? person : previous,
        ),
      }));
    },
    [updateData],
  );
  const replaceFamily = useCallback(
    (family: Family) => {
      updateData((current) => ({
        ...current,
        families: current.families.map((previous) =>
          previous.id === family.id && previous.revision <= family.revision ? family : previous,
        ),
      }));
    },
    [updateData],
  );
  const removeFamily = useCallback(
    (id: string) => {
      updateData((current) => ({
        ...current,
        families: current.families.filter((family) => family.id !== id),
        tree: {
          ...current.tree,
          family_count: current.families.filter((family) => family.id !== id).length,
        },
      }));
    },
    [updateData],
  );
  const updateTreeSummary = useCallback(
    (tree: TreeSummary) => updateData((current) => ({ ...current, tree })),
    [updateData],
  );
  return {
    data,
    loading,
    error,
    refresh,
    replacePerson,
    replaceFamily,
    removeFamily,
    updateTreeSummary,
  };
}
