import {
  BookOpen,
  CalendarDays,
  FileUp,
  CloudDownload,
  FolderHeart,
  GitFork,
  CircleHelp,
  ShieldCheck,
  ArrowUpRight,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import type { TreeSummary } from '../types';
import { personWord } from '../lib/format';
import { PortalBrand } from './PortalBrand';

interface Props {
  trees: TreeSummary[];
  loading: boolean;
  error: string;
  busy: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onGitHub: () => void;
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
  onGitHub,
  onDemo,
  onEdit,
  onDelete,
  onRetry,
}: Props) {
  const demoCount = trees.filter((tree) => tree.is_demo).length;
  return (
    <div className="library-page">
      <header className="library-top">
        <div className="family-brand">
          <PortalBrand />
          <span className="family-brand-divider" aria-hidden="true" />
          <span className="family-brand-label">Родословная <small>GEN</small></span>
        </div>
        <div className="library-top-tools">
          <span className="quiet">Семейный архив</span>
          <a className="header-help-link" href="help/">
            <CircleHelp size={16} /> Как это работает
          </a>
        </div>
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
              Импорт ZIP / GEDCOM / JSON
            </button>
            <button className="button secondary" onClick={onGitHub}>
              <CloudDownload size={18} />
              Открыть из GitHub
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
                  {tree.is_demo && (
                    <span className="tree-demo-badge">Учебный пример</span>
                  )}
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
              <p>Начните с себя, загрузите GEDCOM/JSON или откройте семейный архив из своего GitHub.</p>
              <div className="actions">
                <button className="button primary" onClick={onCreate}>
                  <Plus size={18} />
                  Создать дерево
                </button>
                <button className="button secondary" onClick={onImport}>
                  <FileUp size={18} />
                  Загрузить GEDCOM / JSON
                </button>
                <button className="button secondary" onClick={onGitHub}>
                  <CloudDownload size={18}/>
                  Из GitHub
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
            <h3>{demoCount ? 'Учебный пример уже есть' : 'Сначала познакомиться с редактором'}</h3>
            <p>{demoCount > 1
              ? `В браузере есть ${demoCount} учебных деревьев. Откроем существующее, новую копию не создаём.`
              : demoCount === 1
                ? 'Откроем уже сохранённое учебное дерево — без создания новой копии.'
                : 'Учебное дерево с вымышленной семьёй и несколькими поколениями.'}</p>
          </div>
          <button className="button secondary" disabled={busy} onClick={onDemo}>
            {busy ? 'Открываем…' : 'Открыть пример'}
          </button>
        </section>
        <section className="ownership-card" aria-labelledby="ownership-title">
          <span className="ownership-icon"><ShieldCheck size={23} aria-hidden="true" /></span>
          <div className="ownership-text">
            <span className="ownership-eyebrow">ВАШИ ДАННЫЕ — ПОД ВАШИМ КОНТРОЛЕМ</span>
            <h2 id="ownership-title">Семейный архив принадлежит вам</h2>
            <p>GEN работает в браузере и не загружает дерево на сервер AYYY.
              Оно сохраняется на вашем устройстве, а при желании — в собственном
              приватном репозитории GitHub. Автоматическая синхронизация доступна по вашему выбору.</p>
          </div>
          <div className="ownership-actions">
            <a className="button secondary" href="help/">Как это работает</a>
            <a className="ownership-github-link" href="help/#github">
              Настроить GitHub <ArrowUpRight size={15} aria-hidden="true"/>
            </a>
          </div>
        </section>
        <footer className="library-footer">
          Локальные данные зависят от этого браузера. Регулярно сохраняйте резервную копию JSON или ZIP.
        </footer>
      </main>
    </div>
  );
}
