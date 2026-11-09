import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { appUrl } from '../lib/api';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import {
  BriefcaseBusiness,
  Focus,
  Heart,
  LayoutGrid,
  LocateFixed,
  MapPin,
  MoreHorizontal,
  UsersRound,
} from 'lucide-react';
import type { CardFields, Family, GraphMode, Person } from '../types';
import { familyTones, fullName, initials, years } from '../lib/format';
import { familyPosition, type Point } from '../lib/genealogy';
import { useGraphLayout } from '../lib/useGraphLayout';
import { cleanLegacyLayouts, saveLayout, structuralSignature } from '../lib/graphPreferences';
import '@xyflow/react/dist/style.css';
import '../graph.css';
import { formatDate } from '../lib/dates';

interface FamilyGraphProps {
  treeId: string;
  persons: Person[];
  families: Family[];
  totalCount: number;
  rootId: string | null;
  selectedId: string | null;
  mode: GraphMode;
  depth: number;
  cardFields: CardFields;
  compact?: boolean;
  density?: 'compact' | 'normal' | 'spacious';
  onSelect: (id: string) => void;
  onOpenPerson: (id: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}

type PersonNodeData = {
  person: Person;
  fields: CardFields;
  compact: boolean;
  central: boolean;
  tone: number;
  onMenu: (id: string, x: number, y: number) => void;
};
type PersonFlowNode = Node<PersonNodeData, 'person'>;
type FamilyFlowNode = Node<{ family: Family }, 'family'>;
type GraphNode = PersonFlowNode | FamilyFlowNode;
type GraphEdge = Edge & { pathOptions: { borderRadius: number; offset: number } };
type StoredPositions = Record<string, Point>;
const CARD_WIDTH = 224;
const personNodeId = (id: string) => `person:${id}`;
const familyNodeId = (id: string) => `family:${id}`;

function readPositions(key: string): StoredPositions {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, Point] => {
        const point: unknown = entry[1];
        return Boolean(
          point &&
          typeof point === 'object' &&
          'x' in point &&
          'y' in point &&
          typeof point.x === 'number' &&
          typeof point.y === 'number' &&
          Number.isFinite(point.x) &&
          Number.isFinite(point.y) &&
          Math.abs(point.x) < 1e7 &&
          Math.abs(point.y) < 1e7,
        );
      }),
    );
  } catch {
    return {};
  }
}

const PersonCard = memo(function PersonCard({ data, selected }: NodeProps<PersonFlowNode>) {
  const { person, fields, compact, central, tone, onMenu } = data;
  const name = fullName(person, fields.patronymic);
  const title = person.surname || person.given_name || 'Имя неизвестно';
  const subtitle = person.surname
    ? [person.given_name, fields.patronymic && person.patronymic].filter(Boolean).join(' ')
    : fields.patronymic
      ? person.patronymic
      : '';
  return (
    <div
      className={`person-card${compact ? ' person-card-compact' : ''} family-tone-${tone} person-card--${person.sex.toLowerCase()}${selected ? ' is-selected' : ''}${central ? ' is-central' : ''}`}
    >
      <Handle type="target" position={Position.Top} id="ancestry" isConnectable={false} />
      {central && (
        <span className="person-central-badge">
          <LocateFixed size={10} /> В центре дерева
        </span>
      )}
      <button
        className="person-card-menu nodrag nopan"
        title={`Действия: ${name}`}
        aria-label={`Действия: ${name}`}
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          onMenu(
            person.id,
            event.detail ? event.clientX : rect.right,
            event.detail ? event.clientY : rect.bottom,
          );
        }}
      >
        <MoreHorizontal size={18} />
      </button>
      <div className="person-card-identity">
        {fields.photo && (
          <div className="person-portrait" aria-hidden="true">
            <span>{initials(person)}</span>
            {person.photo_url && (
              <img
                key={person.photo_url}
                src={appUrl(person.photo_url)}
                alt=""
                draggable={false}
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
        )}
        <div className="person-card-name" title={name}>
          <strong>{title}</strong>
          <span>
            {subtitle ||
              (person.sex !== 'M' && person.maiden_name ? `урожд. ${person.maiden_name}` : ' ')}
          </span>
        </div>
      </div>
      <div className="person-card-details">
        {fields.dates && (
          <span
            className="person-dates"
            title={[person.birth_date, person.death_date]
              .filter(Boolean)
              .map(formatDate)
              .join(' — ')}
          >
            {years(person)}
          </span>
        )}
        {fields.places && (
          <span className="person-detail" title={person.birth_place || ''}>
            <MapPin size={12} />
            <span>{person.birth_place || 'Место рождения не указано'}</span>
          </span>
        )}
        {fields.occupation && (
          <span className="person-detail" title={person.occupation || ''}>
            <BriefcaseBusiness size={12} />
            <span>{person.occupation || 'Род занятий не указан'}</span>
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} id="family" isConnectable={false} />
    </div>
  );
});

const FamilyJunction = memo(function FamilyJunction({ data }: NodeProps<FamilyFlowNode>) {
  const { family } = data;
  const label = [
    family.marriage_date && `Брак: ${formatDate(family.marriage_date)}`,
    family.divorce_date && `Развод: ${formatDate(family.divorce_date)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div
      className={`family-junction${family.divorce_date ? ' is-divorced' : ''}`}
      title={label || 'Семейная связь'}
    >
      <Handle type="target" position={Position.Top} id="partners" isConnectable={false} />
      {family.partner1_id && family.partner2_id ? <Heart size={8} /> : <span />}
      <Handle type="source" position={Position.Bottom} id="children" isConnectable={false} />
    </div>
  );
});

const nodeTypes = { person: PersonCard, family: FamilyJunction };

export const FamilyGraph = memo(function FamilyGraph({
  treeId,
  persons,
  families,
  totalCount,
  rootId,
  selectedId,
  mode,
  depth,
  cardFields,
  compact = false,
  density = 'normal',
  onSelect,
  onOpenPerson,
  onContextMenu,
}: FamilyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { clientWidth: width, clientHeight: height } = container;
    if (width && height)
      setViewportSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      );
  }, [treeId, persons.length]);
  useEffect(() => {
    try {
      cleanLegacyLayouts(treeId);
    } catch {
      /* Optional preferences. */
    }
  }, [treeId]);
  useEffect(() => {
    if (
      (window as Window & { __GEN_PROFILE__?: boolean }).__GEN_PROFILE__ &&
      containerRef.current
    ) {
      const element = containerRef.current;
      element.dataset.renderCount = String(Number(element.dataset.renderCount ?? 0) + 1);
    }
  });
  const filtered = useMemo(() => ({ persons, families }), [persons, families]);
  const fields = useMemo(
    () =>
      compact
        ? {
            photo: true,
            dates: true,
            places: false,
            occupation: false,
            patronymic: true,
          }
        : cardFields,
    [compact, cardFields],
  );
  const cardWidth = compact ? 200 : CARD_WIDTH;
  const cardHeight = compact
    ? 92
    : 88 +
      Number(cardFields.dates) * 22 +
      Number(cardFields.places) * 21 +
      Number(cardFields.occupation) * 21;
  const topology = useMemo(() => structuralSignature(persons, families), [persons, families]);
  // Text, photo and selection changes do not affect card geometry or family topology.
  const tones = useMemo(() => familyTones(persons, families), [topology]);
  const {
    layout,
    pending: layoutPending,
    layoutError,
  } = useGraphLayout(persons, families, topology, { cardWidth, cardHeight, density });
  // Each filtered view has its own coordinates; a full-tree drag cannot scatter a smaller branch.
  const storageKey = `gen:graph-layout:v4:${treeId}:${compact}:${density}:${mode}:${mode === 'all' ? '' : `${rootId}:${depth}`}:${topology}`;
  const loadedPositions = useMemo(() => readPositions(storageKey), [storageKey]);
  const [preference, setPreference] = useState({ key: storageKey, positions: loadedPositions });
  const manualPositions = preference.key === storageKey ? preference.positions : loadedPositions;
  const [notice, setNotice] = useState('');
  const [allConnections, setAllConnections] = useState(true);
  const [flow, setFlow] = useState<ReactFlowInstance<GraphNode, Edge> | null>(null);
  const menuRef = useRef(onContextMenu);
  const selectRef = useRef(onSelect);
  const focusIds = useRef({ rootId, selectedId });
  menuRef.current = onContextMenu;
  selectRef.current = onSelect;
  focusIds.current = { rootId, selectedId };
  const openMenu = useCallback((id: string, x: number, y: number) => menuRef.current(id, x, y), []);

  const initialNodes = useMemo<GraphNode[]>(() => {
    if (layoutPending || layoutError) return [];
    const positions = new Map(layout.positions);
    for (const person of filtered.persons) {
      if (manualPositions[person.id]) positions.set(person.id, manualPositions[person.id]);
    }
    const result: GraphNode[] = filtered.persons.map((person) => ({
      id: personNodeId(person.id),
      type: 'person',
      position: positions.get(person.id)!,
      data: {
        person,
        fields,
        compact,
        central: person.id === focusIds.current.rootId,
        tone: tones.get(person.id) ?? 0,
        onMenu: openMenu,
      },
      selected: person.id === focusIds.current.selectedId,
      width: cardWidth,
      height: cardHeight,
      style: { width: cardWidth, height: cardHeight },
      ariaLabel: `${fullName(person)}, ${years(person)}`,
      ariaRole: 'button',
    }));
    for (const family of filtered.families) {
      const position = familyPosition(
        family,
        positions,
        cardWidth,
        cardHeight,
        layout.familyLanes.get(family.id),
      );
      if (position)
        result.push({
          id: familyNodeId(family.id),
          type: 'family',
          position,
          data: { family },
          width: 14,
          height: 14,
          style: { width: 14, height: 14 },
          draggable: false,
          selectable: false,
          focusable: false,
        });
    }
    return result;
  }, [
    layout,
    filtered,
    manualPositions,
    fields,
    tones,
    compact,
    cardWidth,
    cardHeight,
    layoutPending,
    layoutError,
    openMenu,
  ]);
  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes);
  const [nodeBase, setNodeBase] = useState(initialNodes);
  // Adopt geometry before rendering children: React Flow receives nodes and edges together.
  // Pending/error states retain the last complete picture.
  if (!layoutPending && !layoutError && nodeBase !== initialNodes) {
    setNodeBase(initialNodes);
    setNodes(initialNodes);
  }

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => {
        if (node.type !== 'person') return node;
        const central = node.data.person.id === rootId;
        const selected = node.data.person.id === selectedId;
        if (node.data.central === central && node.selected === selected) return node;
        return {
          ...node,
          selected,
          data: central === node.data.central ? node.data : { ...node.data, central },
        };
      }),
    );
  }, [rootId, selectedId]);

  const baseEdges = useMemo<GraphEdge[]>(() => {
    const visibleIds = new Set(filtered.persons.map((person) => person.id));
    const result: GraphEdge[] = [];
    for (const family of filtered.families) {
      const junction = familyNodeId(family.id);
      const stroke = '#9caea6';
      const opacity = 1;
      for (const parentId of new Set([family.partner1_id, family.partner2_id])) {
        if (!parentId || !visibleIds.has(parentId)) continue;
        result.push({
          id: `${junction}:parent:${parentId}`,
          source: personNodeId(parentId),
          target: junction,
          sourceHandle: 'family',
          targetHandle: 'partners',
          type: 'smoothstep',
          pathOptions: { borderRadius: 7, offset: 8 },
          style: { stroke, opacity, strokeWidth: 1.3 },
          selectable: false,
          focusable: false,
        });
      }
      for (const child of family.children) {
        if (!visibleIds.has(child.person_id)) continue;
        const adopted = child.pedigree === 'adopted' || child.pedigree === 'foster';
        result.push({
          id: `${junction}:child:${child.person_id}`,
          source: junction,
          target: personNodeId(child.person_id),
          sourceHandle: 'children',
          targetHandle: 'ancestry',
          type: 'smoothstep',
          pathOptions: { borderRadius: 7, offset: 12 },
          style: {
            stroke,
            opacity,
            strokeWidth: 1.3,
            strokeDasharray: adopted ? '5 4' : undefined,
          },
          selectable: false,
          focusable: false,
        });
      }
    }
    return result;
  }, [filtered]);
  const memberFamilies = useMemo(() => {
    const index = new Map<string, Set<string>>();
    for (const family of filtered.families) {
      for (const id of [
        family.partner1_id,
        family.partner2_id,
        ...family.children.map((child) => child.person_id),
      ]) {
        if (!id) continue;
        const group = index.get(id) ?? new Set<string>();
        group.add(familyNodeId(family.id));
        index.set(id, group);
      }
    }
    return index;
  }, [filtered]);
  const edgeCache = useRef(new Map<string, { base: GraphEdge; state: string; edge: GraphEdge }>());
  const readyEdges = useRef<GraphEdge[]>([]);
  const edges = useMemo(() => {
    if (layoutPending || layoutError) return readyEdges.current;
    const highlightedFamilies = selectedId ? memberFamilies.get(selectedId) : undefined;
    const cache = new Map<string, { base: GraphEdge; state: string; edge: GraphEdge }>();
    const result: GraphEdge[] = [];
    for (const base of baseEdges) {
      const junction = base.source.startsWith('family:') ? base.source : base.target;
      const highlighted = highlightedFamilies?.has(junction) ?? false;
      if (!allConnections && selectedId && !highlighted) continue;
      const state = highlighted ? 'highlighted' : selectedId ? 'dimmed' : 'normal';
      const previous = edgeCache.current.get(base.id);
      const edge =
        previous?.base === base && previous.state === state
          ? previous.edge
          : {
              ...base,
              style: {
                ...base.style,
                stroke: highlighted ? 'var(--accent)' : '#9caea6',
                opacity: selectedId && !highlighted ? 0.35 : 1,
                strokeWidth: highlighted ? 2.4 : 1.3,
              },
            };
      cache.set(base.id, { base, state, edge });
      result.push(edge);
    }
    edgeCache.current = cache;
    readyEdges.current = result;
    return result;
  }, [baseEdges, memberFamilies, selectedId, allConnections, layoutPending, layoutError]);

  const onNodesChange = useCallback(
    (changes: NodeChange<GraphNode>[]) => {
      const selection = changes.find((change) => change.type === 'select' && change.selected);
      if (selection && 'id' in selection && selection.id.startsWith('person:'))
        selectRef.current(selection.id.slice(7));
      setNodes((current) => {
        const updated = applyNodeChanges(
          changes.filter((change) => change.type !== 'select' && change.type !== 'remove'),
          current,
        );
        const moved = new Set(
          changes.filter((change) => change.type === 'position').map((change) => change.id),
        );
        if (!moved.size) return updated;
        const positions = new Map(
          updated.flatMap((node) =>
            node.type === 'person' ? [[node.data.person.id, node.position] as [string, Point]] : [],
          ),
        );
        return updated.map((node) => {
          if (node.type !== 'family') return node;
          const family = node.data.family;
          const parents = [family.partner1_id, family.partner2_id].filter((id): id is string =>
            Boolean(id),
          );
          const members = parents.length
            ? parents
            : family.children.map((child) => child.person_id);
          if (!members.some((id) => moved.has(personNodeId(id)))) return node;
          const position = familyPosition(
            family,
            positions,
            cardWidth,
            cardHeight,
            layout.familyLanes.get(family.id),
          );
          return position ? { ...node, position } : node;
        });
      });
    },
    [cardWidth, cardHeight, layout.familyLanes],
  );

  const fit = useCallback(() => {
    void flow?.fitView({ padding: 0.18, minZoom: 0.12, maxZoom: 1, duration: 250 });
  }, [flow]);
  const showReadableView = useCallback(() => {
    const container = containerRef.current;
    if (!flow || !container) return;
    const people = flow.getNodes().filter((node) => node.type === 'person');
    if (!people.length) return;
    const bounds = flow.getNodesBounds(people);
    const fittedZoom = Math.min(
      container.clientWidth / (bounds.width * 1.36),
      container.clientHeight / (bounds.height * 1.36),
    );
    if (fittedZoom >= 0.8) {
      void flow.fitView({ padding: 0.18, minZoom: 0.8, maxZoom: 1, duration: 250 });
      return;
    }
    const { rootId: root, selectedId: selected } = focusIds.current;
    const focus =
      people.find((node) => node.id === personNodeId(root ?? '')) ??
      people.find((node) => node.id === personNodeId(selected ?? '')) ??
      people[0];
    void flow.setCenter(focus.position.x + cardWidth / 2, focus.position.y + cardHeight / 2, {
      zoom: 0.9,
      duration: 250,
    });
  }, [flow, cardWidth, cardHeight]);
  const visibleIds = topology;
  const initialCamera = useRef(false);
  const initialViewport = useRef<{ x: number; y: number; zoom: number } | null>(null);
  if (!initialViewport.current && nodes.length && !layoutPending && viewportSize.width) {
    const people = nodes.filter((node): node is PersonFlowNode => node.type === 'person');
    const { width, height } = viewportSize;
    const left = Math.min(...people.map((node) => node.position.x));
    const right = Math.max(...people.map((node) => node.position.x)) + cardWidth;
    const top = Math.min(...people.map((node) => node.position.y));
    const bottom = Math.max(...people.map((node) => node.position.y)) + cardHeight;
    const fittedZoom = Math.min(width / ((right - left) * 1.36), height / ((bottom - top) * 1.36));
    const focus =
      people.find((node) => node.data.person.id === rootId) ??
      people.find((node) => node.data.person.id === selectedId) ??
      people[0];
    const zoom = fittedZoom >= 0.8 ? Math.min(1, fittedZoom) : 0.9;
    const centerX = fittedZoom >= 0.8 ? (left + right) / 2 : focus.position.x + cardWidth / 2;
    const centerY = fittedZoom >= 0.8 ? (top + bottom) / 2 : focus.position.y + cardHeight / 2;
    initialViewport.current = {
      x: width / 2 - centerX * zoom,
      y: height / 2 - centerY * zoom,
      zoom,
    };
  }
  useEffect(() => {
    if (layoutPending || !flow) return;
    if (!initialCamera.current) {
      initialCamera.current = true;
      return;
    }
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      // React Flow receives the new nodes in the preceding effect, then measures its viewport.
      secondFrame = requestAnimationFrame(showReadableView);
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [showReadableView, flow, treeId, rootId, mode, depth, visibleIds, layoutPending]);

  useEffect(() => {
    const container = containerRef.current;
    if (!flow || !container) return;
    let width = container.clientWidth;
    let height = container.clientHeight;
    const observer = new ResizeObserver(() => {
      const nextWidth = container.clientWidth;
      const nextHeight = container.clientHeight;
      if (!nextWidth || !nextHeight || (nextWidth === width && nextHeight === height)) return;
      const viewport = flow.getViewport();
      // Resizing a sidebar preserves the user's zoom and the family at the centre of the view.
      void flow.setViewport({
        ...viewport,
        x: viewport.x + (nextWidth - width) / 2,
        y: viewport.y + (nextHeight - height) / 2,
      });
      width = nextWidth;
      height = nextHeight;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [flow]);

  const resetLayout = () => {
    setPreference({ key: storageKey, positions: {} });
    setNotice('');
    try {
      localStorage.removeItem(storageKey);
    } catch {
      setNotice('Браузер не смог запомнить новое расположение.');
    }
    requestAnimationFrame(() => requestAnimationFrame(showReadableView));
  };

  const centerPerson = () => {
    const id = selectedId ?? rootId;
    const node = id && flow?.getNode(personNodeId(id));
    if (node)
      void flow?.setCenter(node.position.x + cardWidth / 2, node.position.y + cardHeight / 2, {
        zoom: 1,
        duration: 300,
      });
  };

  if (!persons.length)
    return (
      <div className="graph-empty">
        <UsersRound size={38} />
        <h3>С кого начнётся ваша история?</h3>
        <p>Добавьте первого человека или импортируйте дерево из GEDCOM.</p>
      </div>
    );

  return (
    <div
      ref={containerRef}
      className="family-graph"
      data-layout-pending={layoutPending}
      aria-label="Генеалогическое дерево"
    >
      {nodes.length && viewportSize.width ? (
        <ReactFlow<GraphNode, Edge>
          nodes={nodes}
          edges={edges}
          defaultViewport={initialViewport.current ?? undefined}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onInit={setFlow}
          onNodeClick={(_, node) => {
            if (node.type === 'person') onSelect(node.data.person.id);
          }}
          onNodeDoubleClick={(_, node) => {
            if (node.type === 'person') onOpenPerson(node.data.person.id);
          }}
          onNodeContextMenu={(event, node) => {
            if (node.type === 'person') {
              event.preventDefault();
              onSelect(node.data.person.id);
              openMenu(node.data.person.id, event.clientX, event.clientY);
            }
          }}
          onNodeDragStop={(_, node) => {
            if (node.type !== 'person') return;
            const positions = {
              ...manualPositions,
              [node.data.person.id]: { x: node.position.x, y: node.position.y },
            };
            setPreference({ key: storageKey, positions });
            setNotice('');
            try {
              saveLayout(storageKey, positions, treeId);
            } catch {
              setNotice('Браузер не смог запомнить расположение карточек.');
            }
          }}
          nodesConnectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          selectNodesOnDrag={false}
          zoomOnDoubleClick={false}
          onlyRenderVisibleElements
          minZoom={0.12}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
          ariaLabelConfig={{
            'controls.zoomIn.ariaLabel': 'Приблизить',
            'controls.zoomOut.ariaLabel': 'Отдалить',
            'controls.fitView.ariaLabel': 'Уместить дерево',
            'node.a11yDescription.default':
              'Нажмите Enter, чтобы выбрать человека. Двойной щелчок открывает биографию.',
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d8e0d6" />
          <Panel position="top-left" className="graph-count">
            <span className="graph-status-dot" />
            <span>
              {layoutPending ? 'Располагаем дерево… ' : layoutError}
              {persons.length === totalCount
                ? `${totalCount} в дереве`
                : `Показано ${persons.length} из ${totalCount}`}
            </span>
          </Panel>
          <Panel position="top-right" className="graph-tools">
            <label className="graph-connections">
              <input
                type="checkbox"
                checked={allConnections}
                onChange={(event) => setAllConnections(event.target.checked)}
              />
              Все связи
            </label>
            <button
              type="button"
              onClick={resetLayout}
              title="Автоматически расположить карточки в этом виде"
            >
              <LayoutGrid size={16} />
              <span>Упорядочить</span>
            </button>
            <button
              type="button"
              onClick={fit}
              title="Уместить всех видимых людей"
              aria-label="Уместить дерево"
            >
              <Focus size={18} />
              <span>Уместить</span>
            </button>
            <button
              type="button"
              onClick={centerPerson}
              disabled={!selectedId && !rootId}
              title="К выбранному человеку"
              aria-label="К выбранному человеку"
            >
              <LocateFixed size={18} />
            </button>
          </Panel>
          <Panel position="bottom-left" className="graph-hint">
            <span>Перетаскивайте карточки</span>
            <i>·</i>
            <span>Двойной щелчок — биография</span>
          </Panel>
          <Controls position="bottom-right" showInteractive={false} />
          {(notice || layout.hasCycles) && (
            <Panel position="bottom-center" className="graph-notice" role="status">
              {notice ||
                'Некоторые связи не укладываются в обычные поколения. Проверьте родство в биографиях.'}
            </Panel>
          )}
        </ReactFlow>
      ) : (
        <div className="graph-count">{layoutError || 'Располагаем дерево…'}</div>
      )}
    </div>
  );
});
