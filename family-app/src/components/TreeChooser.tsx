import {
  BookOpen,
  CalendarDays,
  FileUp,
  FolderHeart,
  GitFork,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import type { TreeSummary } from '../types';
import { personWord } from '../lib/format';

interface Props {
  trees: TreeSummary[];
  loading: boolean;
  error: string;
  busy: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onDemo: () => void;
  onEdit: (tree: TreeSummary) => void;
  onDelete: (tree: TreeSummary) => void;
  onRetry: () => void;
}

export function TreeChooser({
  trees,
  loading,
  error,
  busy,
  onOpen,
  onCreate,
  onImport,
  onDemo,
  onEdit,
  onDelete,
  onRetry,
}: Props) {
  return (
    <div className="library-page">
      <header className="library-top">
        <div className="brand">
          <span className="brand-mark">
            <GitFork size={25} />
          </span>
          <span>
            Родословная<small>GEN</small>
          </span>
        </div>
        <span className="quiet">Семейный архив</span>
      </header>
      <main className="library-content">
        <div className="section-heading">
          <div>
            <span className="eyebrow">МОЯ СЕМЬЯ</span>
            <h1>Семейные деревья</h1>
            <p>Люди, родственные связи и истории, которые хочется сохранить.</p>
          </div>
          <div className="actions">
            <button className="button secondary" onClick={onImport}>
              <FileUp size={18} />
              Импорт GEDCOM
            </button>
            <button className="button primary" onClick={onCreate}>
              <Plus size={18} />
              Новое дерево
            </button>
          </div>
        </div>
        {error && (
          <div className="error-banner">
            {error}
            <button className="text-button" onClick={onRetry}>
              Повторить
            </button>
          </div>
        )}
        {loading ? (
          <div className="loading-state">
            <span className="spinner" />
            Загружаем деревья…
          </div>
        ) : trees.length ? (
          <div className="tree-grid">
            {trees.map((tree, index) => (
              <article className="tree-tile" key={tree.id}>
                <button className="tree-tile-open" onClick={() => onOpen(tree.id)}>
                  <div className={`tree-emblem emblem-${index % 3}`}>
                    <GitFork size={32} strokeWidth={1.5} />
                  </div>
                  <h2>{tree.name}</h2>
                  <p>{tree.description || 'Семейная история'}</p>
                  <div className="tree-tile-meta">
                    <span>
                      <Users size={15} />
                      {tree.person_count} {personWord(tree.person_count)}
                    </span>
                    <span>
                      <CalendarDays size={15} />
                      {new Date(tree.updated_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <span className="tree-open-label">Открыть дерево</span>
                </button>
                <div className="tree-tile-tools">
                  <button
                    className="icon-button"
                    title="Название и описание"
                    aria-label={`Переименовать ${tree.name}`}
                    onClick={() => onEdit(tree)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    title="Удалить дерево"
                    aria-label={`Удалить ${tree.name}`}
                    onClick={() => onDelete(tree)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
            <button className="tree-tile tree-tile-new" onClick={onCreate}>
              <span className="new-tree-icon">
                <Plus size={26} />
              </span>
              <strong>Добавить дерево</strong>
              <span>Начать новую семейную историю</span>
            </button>
          </div>
        ) : (
          !error && (
            <div className="empty-library">
              <span className="empty-library-icon">
                <FolderHeart size={44} strokeWidth={1.4} />
              </span>
              <h2>Ваше первое семейное дерево</h2>
              <p>Начните с себя или загрузите файл .ged из другого генеалогического сервиса.</p>
              <div className="actions">
                <button className="button primary" onClick={onCreate}>
                  <Plus size={18} />
                  Создать дерево
                </button>
                <button className="button secondary" onClick={onImport}>
                  <FileUp size={18} />
                  Загрузить .ged
                </button>
              </div>
            </div>
          )
        )}
        <section className="demo-strip">
          <span className="demo-strip-icon">
            <BookOpen size={25} />
          </span>
          <div>
            <h3>Сначала познакомиться с редактором</h3>
            <p>Учебное дерево с вымышленной семьёй, биографиями и четырьмя поколениями.</p>
          </div>
          <button className="button secondary" disabled={busy} onClick={onDemo}>
            {busy ? 'Создаём…' : 'Открыть пример'}
          </button>
        </section>
        <footer className="library-footer">
          Деревья хранятся на вашем сервере. Для переноса доступны GEDCOM, JSON и архив с
          фотографиями.
        </footer>
      </main>
    </div>
  );
}
