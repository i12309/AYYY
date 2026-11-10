import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ArrowDown,
  ArrowUp,
  EyeOff,
  Layers,
  ChevronDown,
  ChevronLeft,
  Crosshair,
  Download,
  FileJson,
  FileText,
  GitBranch,
  GitFork,
  Heart,
  LayoutGrid,
  ListFilter,
  Plus,
  SlidersHorizontal,
  Table2,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { CardFields, Family, GraphMode, Person, Relation, TreeSummary } from './types';
import { api, appUrl, errorMessage } from './lib/api';
import { fullName, personWord } from './lib/format';
import { useTree } from './lib/useTree';
import {
  applyBranchFilters,
  buildFamilyIndex,
  familyComponents,
  filterTree,
  type HiddenBranch,
  type BranchDirection,
} from './lib/genealogy';
import { BranchFilters } from './components/BranchFilters';
import { TreeChooser } from './components/TreeChooser';
import { TreeDialog, ImportDialog } from './components/TreeDialogs';
import { PersonCreateDialog } from './components/PersonCreateDialog';
import { FamilyDialog } from './components/FamilyDialog';
import { PersonPreview } from './components/PersonPreview';
import { PeopleTable } from './components/PeopleTable';
import { GlobalPersonSearch } from './components/GlobalPersonSearch';
import { Dialog } from './components/Dialog';
import { BackupControl } from './components/BackupControl';
import { PortalBrand } from './components/PortalBrand';
import { CircleHelp } from 'lucide-react';
import { GitHubImportDialog } from './components/GitHubImportDialog';
import {startAutoSync,autoSyncOpened,autoSyncSetActiveTree} from './lib/autoSync';

const FamilyGraph = lazy(() =>
  import('./components/FamilyGraph').then((module) => ({ default: module.FamilyGraph })),
);
const PersonEditor = lazy(() => import('./components/PersonEditor'));
const GenerationMap = lazy(() =>
  import('./components/GenerationMap').then((module) => ({ default: module.GenerationMap })),
);
const loadingView = (
  <div className="loading-state">
    <span className="spinner" />
    Открываем редактор…
  </div>
);

type Modal =
  | { kind: 'tree'; tree?: TreeSummary }
  | { kind: 'import' }
  | { kind: 'github' }
  | { kind: 'person'; id: string }
  | { kind: 'create'; baseId?: string; relation?: Relation }
  | { kind: 'family'; family: Family }
  | { kind: 'warnings'; warnings: string[] }
  | null;
const LARGE_TREE_FOCUS_THRESHOLD = 2500;
const modeOptions: { value: GraphMode; label: string; icon: typeof Users }[] = [
  { value: 'all', label: 'Всё дерево', icon: GitFork },
  { value: 'relatives', label: 'Близкие родственники', icon: Users },
  { value: 'ancestors', label: 'Предки', icon: GitBranch },
  { value: 'descendants', label: 'Потомки', icon: GitBranch },
];
const fieldOptions: { key: keyof CardFields; label: string }[] = [
  { key: 'photo', label: 'Фотография' },
  { key: 'dates', label: 'Годы жизни' },
  { key: 'places', label: 'Место рождения' },
  { key: 'occupation', label: 'Занятие' },
  { key: 'patronymic', label: 'Отчество' },
];

function initialCardFields(): CardFields {
  const defaults = {
    photo: true,
    dates: true,
    places: false,
    occupation: false,
    patronymic: false,
  };
  try {
    const saved = JSON.parse(localStorage.getItem('gen:card-fields') || '{}');
    for (const key of Object.keys(defaults) as (keyof CardFields)[])
      if (typeof saved[key] === 'boolean') defaults[key] = saved[key];
  } catch {
    /* A blocked browser store must not block the editor. */
  }
  return defaults;
}

export default function App() {
  // Classic GEN is the only visual style. Old theme preference is obsolete.
  useEffect(() => {
    document.documentElement.removeAttribute('data-gen-theme');
    try {localStorage.removeItem('gen:theme');} catch {/* Optional preference cleanup. */}
  }, []);
  const [treeId, setTreeId] = useState<string | null>(() =>
    new URLSearchParams(location.search).get('tree'),
  );
  const [trees, setTrees] = useState<TreeSummary[]>([]);
  const [treesLoading, setTreesLoading] = useState(true);
  const [treesError, setTreesError] = useState('');
  const [busy, setBusy] = useState(false);
  const openingDemo = useRef(false);
  const [view, setView] = useState<'graph' | 'table' | 'generations'>('graph');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rootId, setRootId] = useState<string | null>(null);
  const [mode, setMode] = useState<GraphMode>('all');
  const [explicitWholeTree, setExplicitWholeTree] = useState(false);
  const [depth, setDepth] = useState(3);
  const [unlimitedDepth, setUnlimitedDepth] = useState(false);
  const [cardFields, setCardFields] = useState<CardFields>(initialCardFields);
  const [appearance, setAppearance] = useState<{
    compact: boolean;
    density: 'compact' | 'normal' | 'spacious';
  }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gen:appearance') || '{}');
      return {
        compact: saved.compact === true,
        density: ['compact', 'normal', 'spacious'].includes(saved.density)
          ? saved.density
          : 'normal',
      };
    } catch {
      return { compact: false, density: 'normal' };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('gen:appearance', JSON.stringify(appearance));
    } catch {
      /* Optional view preferences. */
    }
  }, [appearance]);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 800);
  const [previewOpen, setPreviewOpen] = useState(() => window.innerWidth >= 1180);
  const [search, setSearch] = useState('');
  const searchText = useRef('');
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [context, setContext] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigationGuard = useRef<(() => boolean) | null>(null);
  const currentUrl = useRef(location.href);
  const registerNavigationGuard = useCallback((guard: (() => boolean) | null) => {
    navigationGuard.current = guard;
  }, []);
  const {
    data,
    loading,
    error,
    refresh,
    replacePerson,
    replaceFamily,
    removeFamily,
    updateTreeSummary,
  } = useTree(treeId);
  // The in-tab worker persists after navigating back to the tree library.
  useEffect(() => startAutoSync(), []);
  useEffect(() => {
    if(!treeId){autoSyncSetActiveTree(null);return;}
    // Every explicit tree open checks remote freshness, even if this tree
    // was opened moments ago. The 60s throttle applies only to window focus.
    void autoSyncOpened(treeId,true);
    const onRemoteUpdate=(event:Event)=>{
      if((event as CustomEvent<{treeId:string}>).detail?.treeId===treeId)
        void refresh();
    };
    window.addEventListener('gen:remote-updated',onRemoteUpdate);
    return ()=>window.removeEventListener('gen:remote-updated',onRemoteUpdate);
  },[treeId,refresh]);
  useEffect(()=>{
    const guard=(event:Event)=>{
      if(modal!==null||navigationGuard.current)event.preventDefault();
    };
    window.addEventListener('gen:remote-refresh-request',guard);
    return ()=>window.removeEventListener('gen:remote-refresh-request',guard);
  },[modal]);
  const familyIndex = useMemo(
    () => buildFamilyIndex(data?.persons ?? [], data?.families ?? []),
    [data],
  );
  const components = useMemo(
    () => familyComponents(data?.persons ?? [], data?.families ?? []),
    [data],
  );
  const branchKey = `gen:branches:v1:${treeId}`;
  const savedBranches = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(branchKey) ?? '{}');
      return {
        key: branchKey,
        hidden: (Array.isArray(saved.hidden) ? saved.hidden : []).filter(
          (rule: HiddenBranch) =>
            rule &&
            typeof rule.personId === 'string' &&
            ['ancestors', 'descendants'].includes(rule.direction),
        ) as HiddenBranch[],
        componentId: typeof saved.componentId === 'string' ? saved.componentId : null,
      };
    } catch {
      return { key: branchKey, hidden: [] as HiddenBranch[], componentId: null as string | null };
    }
  }, [branchKey]);
  const [branchPreference, setBranchPreference] = useState(savedBranches);
  const branches = branchPreference.key === branchKey ? branchPreference : savedBranches;
  const hidden = branches.hidden.filter((rule) => familyIndex.persons.has(rule.personId));
  const component = components.find((members) => members[0] === branches.componentId) ?? null;
  function saveBranches(rules: HiddenBranch[], componentId: string | null = branches.componentId) {
    const preference = { key: branchKey, hidden: rules, componentId };
    setBranchPreference(preference);
    try {
      localStorage.setItem(branchKey, JSON.stringify(preference));
    } catch {
      /* Optional view preferences. */
    }
  }
  function hideBranch(personId: string, direction: BranchDirection) {
    saveBranches([
      ...hidden.filter((rule) => rule.personId !== personId || rule.direction !== direction),
      { personId, direction },
    ]);
    setContext(null);
  }
  function toggleBranch(personId: string, direction: BranchDirection) {
    if (hidden.some((rule) => rule.personId === personId && rule.direction === direction)) {
      saveBranches(
        hidden.filter((rule) => rule.personId !== personId || rule.direction !== direction),
      );
      setContext(null);
    } else hideBranch(personId, direction);
  }
  function showBranch(personId: string, direction: BranchDirection) {
    focusPerson(personId);
    setMode(direction);
    saveBranches([], null);
  }
  const selected = data?.persons.find((person) => person.id === selectedId);
  const query = search.trim().toLocaleLowerCase('ru');
  const matches = useCallback(
    (person: Person) =>
      `${fullName(person)} ${person.maiden_name} ${person.birth_place} ${person.occupation}`
        .toLocaleLowerCase('ru')
        .includes(query),
    [query],
  );
  const largeTree = Boolean(data && data.persons.length > LARGE_TREE_FOCUS_THRESHOLD);
  // Avoid an eager layout of tens of thousands of ReactFlow nodes.
  const effectiveMode: GraphMode =
    largeTree && mode === 'all' && !explicitWholeTree ? 'relatives' : mode;
  const filterRootId = effectiveMode === 'all' ? null : rootId || data?.persons[0]?.id || null;
  const visible = useMemo(
    () =>
      data
        ? applyBranchFilters(
            filterTree(
              data.persons,
              data.families,
              filterRootId,
              effectiveMode,
              unlimitedDepth ? data.persons.length : depth,
              familyIndex,
            ),
            familyIndex,
            branches.hidden,
            component,
          )
        : { persons: [], families: [] },
    [data, filterRootId, effectiveMode, depth, unlimitedDepth, familyIndex, branches, component],
  );
  const tablePeople = useMemo(
    () => (
      largeTree && view === 'table' && mode === 'all' && !explicitWholeTree &&
      !branches.hidden.length && !component
        ? data?.persons ?? []
        : visible.persons
    ).filter(matches),
    [largeTree, view, mode, explicitWholeTree, branches.hidden, component, data, visible, matches],
  );
  const handleSearchQuery = useCallback(
    (text: string) => {
      searchText.current = text;
      if (view === 'table') setSearch(text);
    },
    [view],
  );
  useEffect(() => {
    if (view === 'table') setSearch(searchText.current);
  }, [view]);

  const loadTrees = useCallback(async () => {
    setTreesLoading(true);
    setTreesError('');
    try {
      setTrees(await api<TreeSummary[]>('/trees'));
    } catch (error) {
      setTreesError(errorMessage(error));
    } finally {
      setTreesLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadTrees();
  }, [loadTrees]);
  useEffect(() => {
    const handler = () => {
      if (navigationGuard.current && !navigationGuard.current()) {
        history.pushState({}, '', currentUrl.current);
        return;
      }
      currentUrl.current = location.href;
      setTreeId(new URLSearchParams(location.search).get('tree'));
      setSelectedId(null);
      setRootId(null);
      setModal(null);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  useEffect(() => {
    if (!data) return;
    const scores = new Map<string, number>();
    for (const f of data.families)
      for (const id of [f.partner1_id, f.partner2_id, ...f.children.map((c) => c.person_id)])
        if (id) scores.set(id, (scores.get(id) || 0) + 1);
    const first =
      [...data.persons].sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0))[0]?.id ||
      null;
    setSelectedId((current) => (data.persons.some((p) => p.id === current) ? current : first));
    setRootId((current) => (data.persons.some((p) => p.id === current) ? current : first));
  }, [data]);
  useEffect(() => {
    try {
      localStorage.setItem('gen:card-fields', JSON.stringify(cardFields));
    } catch {
      /* Preferences are optional. */
    }
  }, [cardFields]);
  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!context) return;
    menuRef.current?.querySelector<HTMLElement>('button')?.focus();
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setContext(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContext(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
    };
  }, [context]);

  function openTree(id: string | null) {
    setTreeId(id);
    setSelectedId(null);
    setRootId(null);
    setSearch('');
    setMode('all');
    setExplicitWholeTree(false);
    setModal(null);
    setContext(null);
    setPreviewOpen(window.innerWidth >= 1180);
    const url = new URL(location.href);
    if (id) url.searchParams.set('tree', id);
    else url.searchParams.delete('tree');
    history.pushState({}, '', url);
    currentUrl.current = location.href;
    if (!id) void loadTrees();
  }
  const selectPerson = useCallback((id: string) => {
    setSelectedId(id);
    setPreviewOpen(true);
  }, []);
  const showPerson = useCallback(
    (id: string) => {
      selectPerson(id);
      setContext(null);
      setModal({ kind: 'person', id });
    },
    [selectPerson],
  );
  function focusPerson(id: string) {
    selectPerson(id);
    setRootId(id);
    setSearch('');
    setContext(null);
    // Search and navigation must be able to reveal a person hidden by view preferences.
    if (data && !visible.persons.some((person) => person.id === id)) saveBranches([], null);
  }
  function addRelative(id: string, relation: Relation) {
    setContext(null);
    setModal({ kind: 'create', baseId: id, relation });
  }
  const openContext = useCallback(
    (id: string, x: number, y: number) => {
      selectPerson(id);
      setContext({
        id,
        x: Math.max(8, Math.min(x, window.innerWidth - 262)),
        y: Math.max(8, Math.min(y, window.innerHeight - 520)),
      });
    },
    [selectPerson],
  );
  async function createDemo() {
    if (openingDemo.current) return;
    openingDemo.current = true;
    setBusy(true);
    try {
      const tree = await api<TreeSummary>('/trees', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Семья Волковых · пример',
          description: 'Учебное дерево. Все люди и события вымышлены.',
          demo: true,
        }),
      });
      await loadTrees();
      openTree(tree.id);
    } catch (error) {
      setNotice({ text: errorMessage(error), error: true });
    } finally {
      openingDemo.current = false;
      setBusy(false);
    }
  }
  async function deleteTree(tree: TreeSummary) {
    if (
      !window.confirm(
        `Удалить дерево «${tree.name}» вместе с людьми и фотографиями? При необходимости сначала скачайте полный архив.`,
      )
    )
      return;
    try {
      await api(`/trees/${tree.id}`, { method: 'DELETE' });
      await loadTrees();
      setNotice({ text: 'Дерево удалено' });
    } catch (error) {
      setNotice({ text: errorMessage(error), error: true });
    }
  }
  async function deletePerson(id: string) {
    const person = data?.persons.find((p) => p.id === id);
    if (
      !person ||
      !window.confirm(
        `Удалить ${fullName(person)} и его связи из дерева? Остальные люди сохранятся.`,
      )
    )
      return;
    setContext(null);
    try {
      await api(`/trees/${treeId}/persons/${id}`, { method: 'DELETE' });
      setModal(null);
      await refresh();
      setNotice({ text: 'Человек удалён из дерева' });
    } catch (error) {
      setNotice({ text: errorMessage(error), error: true });
    }
  }
  async function afterPersonCreated(id: string) {
    await refresh();
    setModal(null);
    selectPerson(id);
    setRootId(id);
    setNotice({ text: 'Сохранено. Откройте биографию, чтобы добавить подробности.' });
  }
  async function afterFamilySaved(updated?: Family) {
    if (updated) replaceFamily(updated);
    else if (modal?.kind === 'family') removeFamily(modal.family.id);
    setModal(null);
    setNotice({ text: 'Семейные связи сохранены' });
  }
  async function afterTreeSaved(tree: TreeSummary, warning?:string) {
    await loadTrees();
    if (modal?.kind === 'tree' && modal.tree) {
      if (tree.id === treeId) updateTreeSummary(tree);
      setModal(null);
    } else openTree(tree.id);
    if(warning) setNotice({text:warning,error:true});
  }
  const editorPerson =
    modal?.kind === 'person' ? data?.persons.find((p) => p.id === modal.id) : undefined;

  return (
    <>
      {!treeId ? (
        <TreeChooser
          trees={trees}
          loading={treesLoading}
          error={treesError}
          busy={busy}
          onOpen={openTree}
          onCreate={() => setModal({ kind: 'tree' })}
          onImport={() => setModal({ kind: 'import' })}
          onGitHub={() => setModal({ kind: 'github' })}
          onDemo={() => void createDemo()}
          onEdit={(tree) => setModal({ kind: 'tree', tree })}
          onDelete={(tree) => void deleteTree(tree)}
          onRetry={() => void loadTrees()}
        />
      ) : (
        <div className="app-shell">
          <header className="app-header">
            <div className="header-left">
              <PortalBrand />
              <span className="family-brand-divider" aria-hidden="true" />
              <div className="header-tree">
                <button className="breadcrumb" onClick={() => openTree(null)}>
                  <ChevronLeft size={13} />
                  Все деревья
                </button>
                <button
                  className="tree-name-button"
                  onClick={() => data && setModal({ kind: 'tree', tree: data.tree })}
                >
                  {data?.tree.name || 'Загрузка дерева'}
                  <ChevronDown size={15} />
                </button>
              </div>
            </div>
            <GlobalPersonSearch
              key={treeId}
              persons={data?.persons ?? []}
              onSelect={focusPerson}
              onQuery={handleSearchQuery}
            />
            <div className="header-actions">
              <a className="header-help-link" href="help/" title="Как устроен семейный архив">
                <CircleHelp size={16} />
                <span>Справка</span>
              </a>
              {data && (
                <BackupControl
                  tree={data.tree}
                  onSaved={refresh}
                  onNavigationGuard={registerNavigationGuard}
                />
              )}
              <details className="export-menu">
                <summary className="button secondary">
                  <Download size={17} />
                  <span>Скачать</span>
                  <ChevronDown size={14} />
                </summary>
                <div>
                  <a href={appUrl(`/api/trees/${treeId}/export.ged`)} download>
                    <FileText size={17} />
                    <span>GEDCOM (.ged)<small>Экспорт в исходной версии GEDCOM</small></span>
                  </a>
                  <a href={appUrl(`/api/trees/${treeId}/tree.json`)} download>
                    <FileJson size={17} />
                    <span>
                      Документ (.json)<small>Данные дерева</small>
                    </span>
                  </a>
                  <a href={appUrl(`/api/trees/${treeId}/backup.zip`)} download>
                    <Download size={17} />
                    <span>
                      Полный архив (.zip)<small>Данные и фотографии</small>
                    </span>
                  </a>
                </div>
              </details>
              <button
                className="button primary"
                onClick={() => setModal({ kind: 'create' })}
                disabled={!data}
              >
                <Plus size={18} />
                <span>Человек</span>
              </button>
            </div>
          </header>
          <div className="workspace-toolbar">
            <div className="workspace-nav">
              <button
                className={`icon-button ${sidebarOpen ? 'active' : ''}`}
                title="Фильтры и карточки"
                aria-label="Фильтры и карточки"
                aria-pressed={sidebarOpen}
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <SlidersHorizontal size={19} />
              </button>
              <div className="view-tabs">
                <button
                  className={view === 'graph' ? 'active' : ''}
                  onClick={() => setView('graph')}
                >
                  <GitFork size={16} />
                  Дерево
                </button>
                <button
                  className={view === 'table' ? 'active' : ''}
                  onClick={() => setView('table')}
                >
                  <Table2 size={16} />
                  Таблица
                </button>
                <button
                  className={view === 'generations' ? 'active' : ''}
                  onClick={() => setView('generations')}
                >
                  <Layers size={16} />
                  Карта поколений
                </button>
              </div>
            </div>
            <div className="toolbar-info">
              <span>
                {data
                  ? `${view === 'table' ? tablePeople.length : visible.persons.length} из ${data.persons.length} ${personWord(data.persons.length)}`
                  : ''}
              </span>
              {largeTree && !explicitWholeTree && (
                <span className="large-tree-note" title="Таблица показывает всех людей, граф ограничен ближайшими родственниками.">
                  Большое дерево: ближайшие родственники
                </span>
              )}
              {data && (
                <span
                  className="save-info"
                  title={new Date(data.tree.updated_at).toLocaleString('ru-RU')}
                >
                  Сохранено{' '}
                  {new Date(data.tree.updated_at).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          </div>
          <div
            className={`workspace ${sidebarOpen ? '' : 'settings-hidden'} ${previewOpen && selected ? 'has-preview' : ''}`}
          >
            {sidebarOpen && (
              <aside className="settings-sidebar">
                <div className="settings-scroll">
                  <section>
                    <div className="sidebar-heading">
                      <ListFilter size={16} />
                      <h2>Родство</h2>
                    </div>
                    <div className="filter-modes">
                      {modeOptions.map((option) => (
                        <button
                          key={option.value}
                          className={effectiveMode === option.value ? 'active' : ''}
                          onClick={() => {
                            if (option.value === 'all' && largeTree && !explicitWholeTree) {
                              if (!window.confirm(
                                `Полный граф содержит ${data?.persons.length} человек и может загружаться долго. Рекомендуем сначала ближайших родственников, а весь список открыть в таблице. Всё равно построить полный граф?`,
                              )) return;
                              setExplicitWholeTree(true);
                            }
                            setMode(option.value);
                            if (option.value === 'all') saveBranches([], null);
                          }}
                        >
                          <option.icon
                            size={17}
                            className={option.value === 'ancestors' ? 'rotate-180' : ''}
                          />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="root-settings">
                    <label className="field">
                      Центральный человек
                      <select
                        value={rootId || ''}
                        onChange={(event) => focusPerson(event.target.value)}
                        disabled={!data?.persons.length}
                      >
                        {!data?.persons.length && <option value="">Не выбран</option>}
                        {data?.persons.map((p) => (
                          <option key={p.id} value={p.id}>
                            {fullName(p, false)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className={`depth-setting ${effectiveMode === 'all' ? 'disabled' : ''}`}>
                      <label htmlFor="depth-range">
                        {effectiveMode === 'relatives' ? 'Глубина родства' : 'Поколений от центра'}
                        <strong>{effectiveMode === 'all' || unlimitedDepth ? 'Все' : depth}</strong>
                      </label>
                      <input
                        id="depth-range"
                        type="range"
                        min="1"
                        max="8"
                        value={depth}
                        onChange={(event) => setDepth(Number(event.target.value))}
                        disabled={effectiveMode === 'all' || unlimitedDepth}
                      />
                      <div className="range-labels">
                        <span>1</span>
                        <span>8</span>
                      </div>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={unlimitedDepth}
                          onChange={(event) => setUnlimitedDepth(event.target.checked)}
                          disabled={effectiveMode === 'all'}
                        />
                        Все поколения ветки
                      </label>
                    </div>
                  </section>
                  <BranchFilters
                    index={familyIndex}
                    rootId={rootId}
                    selectedId={selectedId}
                    components={components}
                    componentId={component?.[0] ?? null}
                    hidden={hidden}
                    onComponent={(id) => saveBranches(hidden, id)}
                    onHide={hideBranch}
                    onBranch={showBranch}
                    onRestore={(rule) =>
                      saveBranches(
                        rule
                          ? hidden.filter(
                              (item) =>
                                item.personId !== rule.personId ||
                                item.direction !== rule.direction,
                            )
                          : [],
                      )
                    }
                  />
                  <section>
                    <div className="sidebar-heading">
                      <LayoutGrid size={16} />
                      <h2>На карточке</h2>
                    </div>
                    <div className="card-fields">
                      <label className="field">
                        Карточки
                        <select
                          value={appearance.compact ? 'compact' : 'normal'}
                          onChange={(event) =>
                            setAppearance((current) => ({
                              ...current,
                              compact: event.target.value === 'compact',
                            }))
                          }
                        >
                          <option value="normal">Обычные</option>
                          <option value="compact">Компактные</option>
                        </select>
                      </label>
                      <label className="field">
                        Плотность дерева
                        <select
                          value={appearance.density}
                          onChange={(event) =>
                            setAppearance((current) => ({
                              ...current,
                              density: event.target.value as typeof current.density,
                            }))
                          }
                        >
                          <option value="compact">Компактно</option>
                          <option value="normal">Обычно</option>
                          <option value="spacious">Просторно</option>
                        </select>
                      </label>
                      {fieldOptions.map((option) => (
                        <label className="checkbox-label" key={option.key}>
                          <input
                            type="checkbox"
                            checked={cardFields[option.key]}
                            onChange={(event) =>
                              setCardFields((fields) => ({
                                ...fields,
                                [option.key]: event.target.checked,
                              }))
                            }
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </section>
                  <div className="sidebar-tip">
                    <BookOpen size={18} />
                    <p>
                      Двойной щелчок по человеку открывает биографию. Правый щелчок — действия с
                      семьёй.
                    </p>
                  </div>
                </div>
                <footer className="sidebar-stats">
                  <div>
                    <Users size={18} />
                    <strong>{data?.persons.length || 0}</strong>
                    <span>людей</span>
                  </div>
                  <div>
                    <Heart size={18} />
                    <strong>{data?.families.length || 0}</strong>
                    <span>семей</span>
                  </div>
                </footer>
              </aside>
            )}
            <main className="working-area">
              {loading ? (
                <div className="loading-state">
                  <span className="spinner" />
                  Загружаем дерево…
                </div>
              ) : error ? (
                <div className="empty-state">
                  <h2>Не удалось открыть дерево</h2>
                  <p>{error}</p>
                  <div className="actions">
                    <button className="button secondary" onClick={() => openTree(null)}>
                      Все деревья
                    </button>
                    <button
                      className="button primary"
                      onClick={() =>
                        void refresh().catch((err) =>
                          setNotice({ text: errorMessage(err), error: true }),
                        )
                      }
                    >
                      Повторить
                    </button>
                  </div>
                </div>
              ) : data && !data.persons.length ? (
                <div className="empty-state">
                  <span className="empty-library-icon">
                    <UserPlus size={38} strokeWidth={1.5} />
                  </span>
                  <h2>С кого начнём?</h2>
                  <p>
                    Добавьте себя или родственника.
                    <br />
                    Затем соедините людей семейными связями.
                  </p>
                  <button className="button primary" onClick={() => setModal({ kind: 'create' })}>
                    <Plus size={18} />
                    Добавить первого человека
                  </button>
                </div>
              ) : data && !visible.persons.length ? (
                <div className="empty-state">
                  <h2>В этом фильтре нет людей</h2>
                  <p>Разверните ветки или выберите другую семейную группу.</p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setMode('all');
                      saveBranches([], null);
                    }}
                  >
                    Показать всё дерево
                  </button>
                </div>
              ) : (
                data &&
                (view === 'graph' ? (
                  <Suspense fallback={loadingView}>
                    <FamilyGraph
                      treeId={data.tree.id}
                      persons={visible.persons}
                      families={visible.families}
                      totalCount={data.persons.length}
                      rootId={rootId}
                      selectedId={selectedId}
                      mode={effectiveMode}
                      depth={unlimitedDepth ? data.persons.length : depth}
                      cardFields={cardFields}
                      compact={appearance.compact}
                      density={appearance.density}
                      onSelect={selectPerson}
                      onOpenPerson={showPerson}
                      onContextMenu={openContext}
                    />
                  </Suspense>
                ) : view === 'generations' ? (
                  <Suspense fallback={loadingView}>
                    <GenerationMap
                      key={treeId}
                      persons={visible.persons}
                      allPersons={data.persons}
                      allFamilies={data.families}
                      families={visible.families}
                      rootId={rootId}
                      onFocus={focusPerson}
                      onOpenPerson={showPerson}
                      onContextMenu={openContext}
                    />
                  </Suspense>
                ) : (
                  <PeopleTable
                    persons={tablePeople}
                    selectedId={selectedId}
                    onSelect={selectPerson}
                    onOpen={showPerson}
                    onContext={openContext}
                  />
                ))
              )}
            </main>
            {previewOpen && selected && data && (
              <PersonPreview
                person={selected}
                persons={data.persons}
                families={data.families}
                isRoot={rootId === selected.id}
                onOpen={() => showPerson(selected.id)}
                onSelect={view === 'generations' ? focusPerson : selectPerson}
                onRoot={() => focusPerson(selected.id)}
                onAdd={(relation) => addRelative(selected.id, relation)}
                onClose={() => setPreviewOpen(false)}
              />
            )}
          </div>
        </div>
      )}
      {context && (
        <div
          className="person-context-menu"
          ref={menuRef}
          role="menu"
          aria-label="Действия с человеком"
          style={{ left: context.x, top: context.y }}
        >
          <button role="menuitem" onClick={() => showPerson(context.id)}>
            <BookOpen size={17} />
            Биография и сведения
          </button>
          <button role="menuitem" onClick={() => focusPerson(context.id)}>
            <Crosshair size={17} />
            Сделать центральным
          </button>
          <hr />
          <button role="menuitem" onClick={() => showBranch(context.id, 'ancestors')}>
            <ArrowUp size={17} />
            Показать предков отсюда
          </button>
          <button role="menuitem" onClick={() => showBranch(context.id, 'descendants')}>
            <ArrowDown size={17} />
            Показать потомков отсюда
          </button>
          <button role="menuitem" onClick={() => toggleBranch(context.id, 'ancestors')}>
            <EyeOff size={17} />
            {hidden.some((rule) => rule.personId === context.id && rule.direction === 'ancestors')
              ? 'Развернуть ветку вверх'
              : 'Скрыть ветку вверх'}
          </button>
          <button role="menuitem" onClick={() => toggleBranch(context.id, 'descendants')}>
            <EyeOff size={17} />
            {hidden.some((rule) => rule.personId === context.id && rule.direction === 'descendants')
              ? 'Развернуть ветку вниз'
              : 'Скрыть ветку вниз'}
          </button>
          <hr />
          <button role="menuitem" onClick={() => addRelative(context.id, 'parent')}>
            <UserPlus size={17} />
            Добавить родителя
          </button>
          <button role="menuitem" onClick={() => addRelative(context.id, 'partner')}>
            <Heart size={17} />
            Добавить партнёра
          </button>
          <button role="menuitem" onClick={() => addRelative(context.id, 'child')}>
            <Plus size={17} />
            Добавить ребёнка
          </button>
          <hr />
          <button role="menuitem" className="danger" onClick={() => void deletePerson(context.id)}>
            <Trash2 size={17} />
            Удалить человека
          </button>
        </div>
      )}
      {modal?.kind === 'tree' && (
        <TreeDialog
          tree={modal.tree}
          onClose={() => setModal(null)}
          onSaved={afterTreeSaved}
          onNavigationGuard={registerNavigationGuard}
        />
      )}
      {modal?.kind === 'import' && (
        <ImportDialog
          onNavigationGuard={registerNavigationGuard}
          onClose={() => setModal(null)}
          onImported={async (tree, warnings) => {
            await loadTrees();
            openTree(tree.id);
            if (warnings.length) setModal({ kind: 'warnings', warnings });
            setNotice({
              text: `Импортировано: ${tree.person_count} ${personWord(tree.person_count)}`,
            });
          }}
        />
      )}
      {modal?.kind === 'github' && (
        <GitHubImportDialog
          onClose={() => setModal(null)}
          onImported={async tree => {
            await loadTrees();
            openTree(tree.id);
            setNotice({text:'Дерево успешно загружено из приватного GitHub.'});
          }}
        />
      )}
      {modal?.kind === 'create' && data && (
        <PersonCreateDialog
          onNavigationGuard={registerNavigationGuard}
          data={data}
          base={data.persons.find((p) => p.id === modal.baseId)}
          relation={modal.relation}
          onClose={() => setModal(null)}
          onCreated={afterPersonCreated}
        />
      )}
      {modal?.kind === 'family' && data && (
        <FamilyDialog
          onNavigationGuard={registerNavigationGuard}
          treeId={data.tree.id}
          family={modal.family}
          persons={data.persons}
          onClose={() => setModal(null)}
          onSaved={afterFamilySaved}
        />
      )}
      {modal?.kind === 'person' && editorPerson && data && (
        <Suspense fallback={<div className="modal-backdrop">{loadingView}</div>}>
          <PersonEditor
            key={editorPerson.id}
            treeId={data.tree.id}
            person={editorPerson}
            persons={data.persons}
            families={data.families}
            onClose={() => setModal(null)}
            onSaved={replacePerson}
            onSelectPerson={showPerson}
            onAddRelative={addRelative}
            onEditFamily={(family) => setModal({ kind: 'family', family })}
            onDeletePerson={(id) => void deletePerson(id)}
            onNavigationGuard={registerNavigationGuard}
          />
        </Suspense>
      )}
      {modal?.kind === 'warnings' && (
        <Dialog title="Дерево импортировано" onClose={() => setModal(null)}>
          <div className="dialog-form">
            <p className="form-description">
              При импорте обнаружены особенности или предупреждения. Исходные GEDCOM-структуры сохранены; фотографии нужно переносить отдельно.
            </p>
            <ul className="import-warnings">
              {modal.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
            <footer className="dialog-footer">
              <button className="button primary" onClick={() => setModal(null)}>
                Открыть дерево
              </button>
            </footer>
          </div>
        </Dialog>
      )}
      {notice && (
        <div
          className={`toast ${notice.error ? 'toast-error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          <span>{notice.text}</span>
          <button
            className="icon-button"
            aria-label="Закрыть уведомление"
            onClick={() => setNotice(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}
