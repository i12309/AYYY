import dagre from '@dagrejs/dagre';
import type { Family, GraphMode, Person } from '../types';

export interface FamilyIndex {
  persons: Map<string, Person>;
  parents: Map<string, Set<string>>;
  children: Map<string, Set<string>>;
  partners: Map<string, Set<string>>;
}

export interface FilteredTree {
  persons: Person[];
  families: Family[];
  generations: Map<string, number>;
}

export type BranchDirection = 'ancestors' | 'descendants';
export interface HiddenBranch {
  personId: string;
  direction: BranchDirection;
}

/** Follow actual parent/child memberships; marriage never extends a lineal branch. */
export function branchMembers(
  index: FamilyIndex,
  personId: string,
  direction: BranchDirection,
): Set<string> {
  const visited = new Set([personId]);
  const queue = [personId];
  const links = direction === 'ancestors' ? index.parents : index.children;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const id of links.get(queue[cursor]) ?? []) {
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(id);
    }
  }
  visited.delete(personId);
  return visited;
}

/** Components are families connected through their members, including parentless siblings. */
export function familyComponents(persons: Person[], families: Family[]): string[][] {
  const neighbors = new Map(persons.map((person) => [person.id, new Set<string>()]));
  for (const family of families) {
    const members = [
      ...partnerIds(family),
      ...family.children.map((child) => child.person_id),
    ].filter((id) => neighbors.has(id));
    for (const id of members)
      for (const other of members) if (id !== other) neighbors.get(id)!.add(other);
  }
  return connectedGroups([...neighbors.keys()].sort(), neighbors);
}

export function applyBranchFilters(
  tree: FilteredTree,
  index: FamilyIndex,
  hidden: HiddenBranch[],
  component: string[] | null,
): FilteredTree {
  const excluded = new Set<string>();
  for (const rule of hidden)
    for (const id of branchMembers(index, rule.personId, rule.direction)) excluded.add(id);
  const allowed = component ? new Set(component) : null;
  const persons = tree.persons.filter(
    (person) => !excluded.has(person.id) && (!allowed || allowed.has(person.id)),
  );
  const visible = new Set(persons.map((person) => person.id));
  const families = tree.families.flatMap((family) => {
    const partner1_id =
      family.partner1_id && visible.has(family.partner1_id) ? family.partner1_id : null;
    const partner2_id =
      family.partner2_id && visible.has(family.partner2_id) ? family.partner2_id : null;
    const children = family.children.filter((child) => visible.has(child.person_id));
    return Number(Boolean(partner1_id)) + Number(Boolean(partner2_id)) + children.length < 2
      ? []
      : [{ ...family, partner1_id, partner2_id, children }];
  });
  return {
    persons,
    families,
    generations: new Map([...tree.generations].filter(([id]) => visible.has(id))),
  };
}

export interface Point {
  x: number;
  y: number;
}

export interface TreeLayout {
  positions: Map<string, Point>;
  familyPositions: Map<string, Point>;
  familyLanes: Map<string, number>;
  generations: Map<string, number>;
  hasCycles: boolean;
}

const partnerIds = (family: Family): string[] => [
  ...new Set([family.partner1_id, family.partner2_id].filter((id): id is string => Boolean(id))),
];

export function buildFamilyIndex(persons: Person[], families: Family[]): FamilyIndex {
  const index: FamilyIndex = {
    persons: new Map(persons.map((person) => [person.id, person])),
    parents: new Map(),
    children: new Map(),
    partners: new Map(),
  };
  for (const id of index.persons.keys()) {
    index.parents.set(id, new Set());
    index.children.set(id, new Set());
    index.partners.set(id, new Set());
  }
  for (const family of families) {
    const partners = partnerIds(family).filter((id) => index.persons.has(id));
    for (const parent of partners) {
      for (const partner of partners) {
        if (parent !== partner) index.partners.get(parent)!.add(partner);
      }
      for (const child of family.children) {
        if (index.persons.has(child.person_id) && child.person_id !== parent) {
          index.children.get(parent)!.add(child.person_id);
          index.parents.get(child.person_id)!.add(parent);
        }
      }
    }
  }
  return index;
}

function relativesOf(index: FamilyIndex, id: string): [string, number][] {
  return [
    ...[...(index.parents.get(id) ?? [])].sort().map((parent) => [parent, -1] as [string, number]),
    ...[...(index.partners.get(id) ?? [])]
      .sort()
      .map((partner) => [partner, 0] as [string, number]),
    ...[...(index.children.get(id) ?? [])].sort().map((child) => [child, 1] as [string, number]),
  ];
}

/** A depth is a generation in lineal views, or a relationship hop in the relatives view. */
export function filterTree(
  persons: Person[],
  families: Family[],
  rootId: string | null,
  mode: GraphMode,
  depth: number,
  existingIndex?: FamilyIndex,
): FilteredTree {
  const index = existingIndex ?? buildFamilyIndex(persons, families);
  const visible = new Set<string>();
  const generations = new Map<string, number>();
  const limit = Number.isFinite(depth) ? Math.max(0, Math.floor(depth)) : 0;
  const root = rootId && index.persons.has(rootId) ? rootId : null;
  const showAll = mode === 'all' || !root;
  const starts = showAll
    ? [...(root ? [root] : []), ...[...index.persons.keys()].sort().filter((id) => id !== root)]
    : [root];

  for (const start of starts) {
    if (visible.has(start)) continue;
    const queue: { id: string; distance: number; generation: number }[] = [
      { id: start, distance: 0, generation: 0 },
    ];
    visible.add(start);
    generations.set(start, 0);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      if (!showAll && current.distance >= limit) continue;
      let next: [string, number][];
      if (!showAll && mode === 'ancestors') {
        next = [...(index.parents.get(current.id) ?? [])].sort().map((id) => [id, -1]);
      } else if (!showAll && mode === 'descendants') {
        next = [...(index.children.get(current.id) ?? [])].sort().map((id) => [id, 1]);
      } else {
        next = relativesOf(index, current.id);
      }
      for (const [id, direction] of next) {
        if (visible.has(id)) continue;
        visible.add(id);
        const generation = current.generation + direction;
        generations.set(id, generation);
        queue.push({ id, distance: current.distance + 1, generation });
      }
    }
  }

  if (!showAll && mode === 'descendants') {
    // Spouses give a descendant's family context but never become traversal roots.
    for (const id of [...visible]) {
      for (const partner of index.partners.get(id) ?? []) {
        if (visible.has(partner)) continue;
        visible.add(partner);
        generations.set(partner, generations.get(id) ?? 0);
      }
    }
  }

  const selectedFamilies = families.flatMap((family) => {
    const partner1_id =
      family.partner1_id && visible.has(family.partner1_id) ? family.partner1_id : null;
    const partner2_id =
      family.partner2_id && visible.has(family.partner2_id) ? family.partner2_id : null;
    const children = family.children.filter((child) => visible.has(child.person_id));
    const count = Number(Boolean(partner1_id)) + Number(Boolean(partner2_id)) + children.length;
    return count < 2 ? [] : [{ ...family, partner1_id, partner2_id, children }];
  });
  return {
    persons: persons.filter((person) => visible.has(person.id)),
    families: selectedFamilies,
    generations,
  };
}

/** Keep spouses in a shared layout unit, while retaining one node per person. */
function partnerGroups(index: FamilyIndex): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const visited = new Set<string>();
  for (const id of [...index.persons.keys()].sort()) {
    if (visited.has(id)) continue;
    const queue = [id];
    visited.add(id);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      for (const partner of [...(index.partners.get(queue[cursor]) ?? [])].sort()) {
        if (visited.has(partner)) continue;
        visited.add(partner);
        queue.push(partner);
      }
    }
    groups.set(id, orderPartners(queue, index));
  }
  return groups;
}

function orderPartners(ids: string[], index: FamilyIndex): string[] {
  const compare = (a: string, b: string) => {
    const pa = index.persons.get(a)!;
    const pb = index.persons.get(b)!;
    return (
      Number(pb.sex === 'M') - Number(pa.sex === 'M') ||
      `${pa.surname} ${pa.given_name}`.localeCompare(`${pb.surname} ${pb.given_name}`, 'ru') ||
      a.localeCompare(b)
    );
  };
  const remaining = new Set(ids);
  const ordered: string[] = [];
  while (remaining.size) {
    const previous = ordered[ordered.length - 1];
    const neighbors = previous
      ? [...(index.partners.get(previous) ?? [])].filter((id) => remaining.has(id))
      : [];
    const candidates = neighbors.length ? neighbors : [...remaining];
    candidates.sort(
      (a, b) =>
        (index.partners.get(a)?.size ?? 0) - (index.partners.get(b)?.size ?? 0) || compare(a, b),
    );
    const next = candidates[0];
    ordered.push(next);
    remaining.delete(next);
  }
  return ordered;
}

function orientPartners(
  members: string[],
  left: number,
  positions: Map<string, Point>,
  index: FamilyIndex,
  cardWidth: number,
): string[] {
  if (members.length < 2) return members;
  const anchors = new Map<string, number>();
  for (const id of members) {
    const parents = [...(index.parents.get(id) ?? [])].flatMap((parent) =>
      positions.has(parent) ? [positions.get(parent)!.x + cardWidth / 2] : [],
    );
    if (parents.length) anchors.set(id, parents.reduce((sum, x) => sum + x, 0) / parents.length);
  }
  const cost = (order: string[]) =>
    order.reduce((sum, id, column) => {
      const anchor = anchors.get(id);
      return anchor === undefined
        ? sum
        : sum + (left + column * (cardWidth + 48) + cardWidth / 2 - anchor) ** 2;
    }, 0);
  const reversed = [...members].reverse();
  // Preserve marriage adjacency while placing each spouse toward their own parents.
  return cost(reversed) < cost(members) ? reversed : members;
}

function rankGroups(
  ids: string[],
  edges: Map<string, Set<string>>,
): { ranks: Map<string, number>; hasCycles: boolean } {
  const indegrees = new Map(ids.map((id) => [id, 0]));
  for (const children of edges.values()) {
    for (const child of children) indegrees.set(child, indegrees.get(child)! + 1);
  }
  const ranks = new Map(ids.map((id) => [id, 0]));
  const done = new Set<string>();
  const queue = ids.filter((id) => indegrees.get(id) === 0);
  let cursor = 0;
  let hasCycles = false;
  while (done.size < ids.length) {
    if (cursor === queue.length) {
      // Imported data may be inconsistent. Break the layout cycle without changing relationships.
      const next = ids.find((id) => !done.has(id));
      if (!next) break;
      hasCycles = true;
      queue.push(next);
    }
    const id = queue[cursor++];
    if (done.has(id)) continue;
    done.add(id);
    for (const child of [...(edges.get(id) ?? [])].sort()) {
      if (done.has(child)) continue;
      ranks.set(child, Math.max(ranks.get(child)!, ranks.get(id)! + 1));
      indegrees.set(child, indegrees.get(child)! - 1);
      if (indegrees.get(child) === 0) queue.push(child);
    }
  }
  return { ranks, hasCycles };
}

function connectedGroups(ids: string[], edges: Map<string, Set<string>>): string[][] {
  const neighbors = new Map(ids.map((id) => [id, new Set<string>()]));
  for (const [parent, children] of edges) {
    for (const child of children) {
      neighbors.get(parent)!.add(child);
      neighbors.get(child)!.add(parent);
    }
  }
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const id of ids) {
    if (visited.has(id)) continue;
    const queue = [id];
    visited.add(id);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      for (const neighbor of [...neighbors.get(queue[cursor])!].sort()) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    components.push(queue.sort());
  }
  return components.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}

/** Junctions always use the positions currently displayed, including manually moved cards. */
export function familyPosition(
  family: Family,
  positions: Map<string, Point>,
  cardWidth: number,
  cardHeight: number,
  lane = 0,
): Point | null {
  const parents = partnerIds(family).flatMap((id) =>
    positions.has(id) ? [positions.get(id)!] : [],
  );
  const children = family.children.flatMap((child) =>
    positions.has(child.person_id) ? [positions.get(child.person_id)!] : [],
  );
  const members = parents.length ? parents : children;
  if (!members.length) return null;
  return {
    x: members.reduce((total, point) => total + point.x + cardWidth / 2, 0) / members.length - 7,
    y: parents.length
      ? Math.max(...parents.map((point) => point.y)) + cardHeight + 28 + lane * 20
      : Math.min(...children.map((point) => point.y)) - 68,
  };
}

export function layoutTree(
  persons: Person[],
  families: Family[],
  {
    cardWidth = 224,
    cardHeight = 124,
    density = 'normal',
  }: { cardWidth?: number; cardHeight?: number; density?: 'compact' | 'normal' | 'spacious' } = {},
): TreeLayout {
  const horizontalGap = density === 'compact' ? 38 : density === 'spacious' ? 116 : 76;
  const partnerGap = density === 'compact' ? 28 : density === 'spacious' ? 72 : 48;
  const generationGap = density === 'compact' ? 96 : density === 'spacious' ? 200 : 140;
  const index = buildFamilyIndex(persons, families);
  const groups = partnerGroups(index);
  const owner = new Map<string, string>();
  for (const [groupId, members] of groups) for (const id of members) owner.set(id, groupId);
  const groupIds = [...groups.keys()].sort();
  const edges = new Map(groupIds.map((id) => [id, new Set<string>()]));
  let internalCycle = false;
  for (const [parent, children] of index.children) {
    for (const child of children) {
      const parentGroup = owner.get(parent)!;
      const childGroup = owner.get(child)!;
      if (parentGroup === childGroup) internalCycle = true;
      else edges.get(parentGroup)!.add(childGroup);
    }
  }
  const { ranks, hasCycles } = rankGroups(groupIds, edges);
  const familyLanes = new Map<string, number>();
  const nextLane = new Map<string, number>();
  for (const family of [...families].sort((a, b) => a.id.localeCompare(b.id))) {
    const parent = partnerIds(family).find((id) => owner.has(id));
    const group = parent ? owner.get(parent)! : family.id;
    const lane = nextLane.get(group) ?? 0;
    familyLanes.set(family.id, lane);
    nextLane.set(group, lane + 1);
  }
  const maxLanes = Math.max(1, ...nextLane.values());
  const rankHeight = cardHeight + generationGap + maxLanes * 20;
  const positions = new Map<string, Point>();
  const generations = new Map<string, number>();
  let offsetX = 0;
  let offsetY = 0;
  let shelfHeight = 0;

  for (const component of connectedGroups(groupIds, edges)) {
    const graph = new dagre.graphlib.Graph()
      .setGraph({
        rankdir: 'TB',
        nodesep: horizontalGap,
        ranksep: generationGap,
        marginx: 0,
        marginy: 0,
      })
      .setDefaultEdgeLabel(() => ({}));
    for (const id of component) {
      graph.setNode(id, {
        width: groups.get(id)!.length * (cardWidth + partnerGap) - partnerGap,
        height: cardHeight,
      });
    }
    for (const parent of component) {
      for (const child of [...edges.get(parent)!].sort()) {
        if (ranks.get(child)! > ranks.get(parent)!) graph.setEdge(parent, child);
      }
    }
    dagre.layout(graph);
    // Dagre may choose different ranks from our generation ranks (e.g. remarriages).
    // Once rows are aligned, pack each entire partner group to prevent card collisions.
    const rows = new Map<number, string[]>();
    for (const id of component) {
      const rank = ranks.get(id)!;
      rows.set(rank, [...(rows.get(rank) ?? []), id]);
    }
    for (const row of rows.values()) {
      row.sort((a, b) => graph.node(a).x - graph.node(b).x || a.localeCompare(b));
      const packed = new Map<string, number>();
      let right = -Infinity;
      let displacement = 0;
      for (const id of row) {
        const node = graph.node(id);
        const original = node.x - node.width / 2;
        const left = Math.max(original, right + horizontalGap);
        packed.set(id, left);
        displacement += left - original;
        right = left + node.width;
      }
      const shift = displacement / row.length;
      for (const id of row) graph.node(id).x = packed.get(id)! - shift + graph.node(id).width / 2;
    }
    const local = new Map<string, Point>();
    const minRank = Math.min(...component.map((id) => ranks.get(id)!));
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = 0;
    for (const id of component) {
      const node = graph.node(id);
      const x = node.x - node.width / 2;
      const y = (ranks.get(id)! - minRank) * rankHeight;
      local.set(id, { x, y });
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + node.width);
      maxY = Math.max(maxY, y + cardHeight);
    }
    const width = maxX - minX;
    if (offsetX && offsetX + width > 1600) {
      offsetX = 0;
      offsetY += shelfHeight + 150;
      shelfHeight = 0;
    }
    const byGeneration = [...local].sort(
      ([a], [b]) => ranks.get(a)! - ranks.get(b)! || a.localeCompare(b),
    );
    for (const [groupId, point] of byGeneration) {
      const left = offsetX + point.x - minX;
      const members = orientPartners(groups.get(groupId)!, left, positions, index, cardWidth);
      members.forEach((id, order) => {
        positions.set(id, { x: left + order * (cardWidth + partnerGap), y: offsetY + point.y });
        generations.set(id, ranks.get(groupId)!);
      });
    }
    offsetX += width + 116;
    shelfHeight = Math.max(shelfHeight, maxY);
  }

  const familyPositions = new Map<string, Point>();
  for (const family of families) {
    const position = familyPosition(
      family,
      positions,
      cardWidth,
      cardHeight,
      familyLanes.get(family.id),
    );
    if (position) familyPositions.set(family.id, position);
  }
  return {
    positions,
    familyPositions,
    familyLanes,
    generations,
    hasCycles: hasCycles || internalCycle,
  };
}
