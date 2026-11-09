import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw } from 'lucide-react';
import type { FamilyIndex, HiddenBranch, BranchDirection } from '../lib/genealogy';
import { branchMembers } from '../lib/genealogy';
import { fullName } from '../lib/format';

interface Props {
  index: FamilyIndex;
  rootId: string | null;
  selectedId: string | null;
  components: string[][];
  componentId: string | null;
  hidden: HiddenBranch[];
  onComponent: (id: string | null) => void;
  onHide: (id: string, direction: BranchDirection) => void;
  onRestore: (rule?: HiddenBranch) => void;
  onBranch: (id: string, direction: BranchDirection) => void;
}

export function BranchFilters({
  index,
  rootId,
  selectedId,
  components,
  componentId,
  hidden,
  onComponent,
  onHide,
  onRestore,
  onBranch,
}: Props) {
  const selected = selectedId ? index.persons.get(selectedId) : undefined;
  const candidates = rootId
    ? [
        ...[...(index.parents.get(rootId) ?? [])].map((id) => ({
          id,
          direction: 'ancestors' as const,
        })),
        ...[...(index.children.get(rootId) ?? [])].map((id) => ({
          id,
          direction: 'descendants' as const,
        })),
      ]
    : [];
  return (
    <section className="branch-settings">
      <div className="sidebar-heading">
        <EyeOff size={16} />
        <h2>Семьи и ветки</h2>
      </div>
      {components.length > 1 && (
        <label className="field">
          Семейная группа
          <select
            value={componentId ?? ''}
            onChange={(event) => onComponent(event.target.value || null)}
          >
            <option value="">Все группы ({components.length})</option>
            {components.map((members) => (
              <option key={members[0]} value={members[0]}>
                {fullName(index.persons.get(members[0])!, false)} · {members.length} чел.
              </option>
            ))}
          </select>
        </label>
      )}
      {selected && (
        <div className="selected-branch-actions">
          <small>От выбранного человека</small>
          <strong>{fullName(selected, false)}</strong>
          {(['ancestors', 'descendants'] as const).map((direction) => {
            const count = branchMembers(index, selected.id, direction).size;
            const collapsed = hidden.some(
              (rule) => rule.personId === selected.id && rule.direction === direction,
            );
            return (
              <div className="branch-action-row" key={direction}>
                <button
                  className="button secondary"
                  onClick={() => onBranch(selected.id, direction)}
                >
                  {direction === 'ancestors' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  {direction === 'ancestors' ? 'Предки' : 'Потомки'} ({count})
                </button>
                <button
                  className="icon-button"
                  disabled={!count}
                  title={collapsed ? 'Развернуть ветку' : 'Скрыть ветку'}
                  aria-label={`${collapsed ? 'Развернуть' : 'Скрыть'} ${direction === 'ancestors' ? 'предков' : 'потомков'} выбранного человека`}
                  onClick={() =>
                    collapsed
                      ? onRestore({ personId: selected.id, direction })
                      : onHide(selected.id, direction)
                  }
                >
                  {collapsed ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {candidates.length > 0 && (
        <details className="detected-branches">
          <summary>Ветки от центра ({candidates.length})</summary>
          {candidates.map(({ id, direction }) => (
            <button
              key={`${id}:${direction}`}
              className="detected-branch"
              onClick={() => onBranch(id, direction)}
            >
              {direction === 'ancestors' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              <span>
                {fullName(index.persons.get(id)!, false)}
                <small>
                  {direction === 'ancestors' ? 'Предки' : 'Потомки'} ·{' '}
                  {branchMembers(index, id, direction).size + 1} чел.
                </small>
              </span>
            </button>
          ))}
        </details>
      )}
      {!!hidden.length && (
        <div className="hidden-branches" role="status">
          <strong>Свёрнуто веток: {hidden.length}</strong>
          {hidden.map((rule) => (
            <button key={`${rule.personId}:${rule.direction}`} onClick={() => onRestore(rule)}>
              <Eye size={14} />
              <span>
                {fullName(index.persons.get(rule.personId)!, false)} ·{' '}
                {rule.direction === 'ancestors' ? 'вверх' : 'вниз'}
              </span>
            </button>
          ))}
          <button className="text-button" onClick={() => onRestore()}>
            <RotateCcw size={14} />
            Развернуть все ветки
          </button>
        </div>
      )}
      <p className="branch-explanation">
        Сворачивание скрывает предков или потомков, включая общих родственников. Сам человек
        остаётся. Данные сохраняются.
      </p>
    </section>
  );
}
