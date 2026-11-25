import type { StoredEpic, StoredItem } from './backlog-archive.js';

export type CardState = 'open' | 'closed' | 'draft';

export interface IssueState {
  readonly state: 'open' | 'closed';
  readonly labels: readonly string[];
}

export type IssueStates = ReadonlyMap<string, IssueState>;

export interface BoardCard {
  readonly key: string;
  readonly kind: StoredItem['kind'];
  readonly title: string;
  readonly size: StoredItem['size'];
  readonly url: string;
  readonly state: CardState;
  readonly stage: string;
  readonly tasks: readonly BoardCard[];
}

export interface BoardEpic {
  readonly id: string;
  readonly project: string;
  readonly updatedOn: string;
  readonly epic: BoardCard;
  readonly done: number;
  readonly total: number;
  readonly stories: readonly BoardCard[];
}

const STAGE_PREFIX = 'status: ';
const STAGE_NAMES: Readonly<Record<string, string>> = {
  building: 'a construir',
  'ready for commit': 'pronta para commit',
  verifying: 'a verificar',
  blocked: 'bloqueada',
  'awaiting commit': 'à espera do commit',
  'in progress': 'em curso',
};

export function boardOf(epics: readonly StoredEpic[], states: IssueStates): BoardEpic[] {
  return epics.flatMap((epic) => boardEpicOf(epic, states)).sort(openFirst);
}

function boardEpicOf(epic: StoredEpic, states: IssueStates): BoardEpic[] {
  const head = epic.items.find((item) => item.kind === 'epic');
  if (head === undefined) {
    return [];
  }
  const cardOf = (item: StoredItem): BoardCard => ({
    key: item.key,
    kind: item.kind,
    title: item.title,
    size: item.size,
    url: item.issueUrl,
    state: stateOf(item, states),
    stage: stageOf(item, states),
    tasks: epic.items.filter((child) => child.parent === item.key && child.kind === 'task').map(cardOf),
  });
  const stories = epic.items.filter((item) => item.parent === head.key).map(cardOf);
  return [
    {
      id: epic.id,
      project: epic.project,
      updatedOn: epic.updatedOn,
      epic: { ...cardOf(head), tasks: [] },
      done: stories.filter((card) => card.state === 'closed').length,
      total: stories.length,
      stories,
    },
  ];
}

function stateOf(item: StoredItem, states: IssueStates): CardState {
  return item.issueUrl === '' ? 'draft' : (states.get(item.issueUrl)?.state ?? 'open');
}

function stageOf(item: StoredItem, states: IssueStates): string {
  const label = states.get(item.issueUrl)?.labels.find((name) => name.startsWith(STAGE_PREFIX)) ?? '';
  return STAGE_NAMES[label.slice(STAGE_PREFIX.length)] ?? '';
}

function openFirst(first: BoardEpic, second: BoardEpic): number {
  const closedFirst = Number(first.epic.state === 'closed') - Number(second.epic.state === 'closed');
  return closedFirst !== 0 ? closedFirst : second.updatedOn.localeCompare(first.updatedOn);
}
