import { useEffect } from 'react';

/** Every dialog close route shares this guard; server writes keep the dialog open. */
export type RegisterNavigationGuard = (guard: (() => boolean) | null) => void;
export function useUnsavedGuard(
  dirty: boolean,
  busy: boolean,
  onClose: () => void,
  register?: RegisterNavigationGuard,
) {
  const canLeave = () =>
    !busy && (!dirty || window.confirm('Есть несохранённые изменения. Закрыть без сохранения?'));
  useEffect(() => {
    register?.(canLeave);
    return () => register?.(null);
  }, [register, dirty, busy]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, busy]);
  return () => {
    if (canLeave()) onClose();
  };
}
