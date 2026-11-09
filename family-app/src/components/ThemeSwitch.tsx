import { Palette } from 'lucide-react';
export type GenTheme = 'classic' | 'ayyy';
export function ThemeSwitch({theme,onToggle}:{theme:GenTheme;onToggle:()=>void}) {
  const active = theme==='classic'?'Classic GEN':'AYYY';
  const next = theme==='classic'?'AYYY':'Classic GEN';
  return <button type="button"
    className="gen-theme-switch"
    onClick={onToggle}
    title={`Текущая тема: ${active}. Переключить на ${next}`}
    aria-label={`Тема оформления: ${active}. Переключить`}
  >
    <Palette size={16} aria-hidden="true"/>
    <span>Тема: <strong>{active}</strong></span>
  </button>;
}
