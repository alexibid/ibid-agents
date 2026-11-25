export type CardState = 'open' | 'closed' | 'draft';
export interface BoardView {
  readonly open: boolean;
  readonly closed: boolean;
}

export interface ProjectBoard {
  readonly project: string;
  readonly epics: readonly BoardEpic[];
}

export interface BoardCard {
  readonly key: string;
  readonly kind: 'epic' | 'story' | 'task';
  readonly title: string;
  readonly size: 'S' | 'M' | 'L';
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

export const STATE_NAMES: Readonly<Record<CardState, string>> = { open: 'Aberta', closed: 'Fechada', draft: 'Rascunho' };


export function boardByProject(board: readonly BoardEpic[], view: BoardView): ProjectBoard[] {
  const shown = board.filter((entry) => isShown(entry.epic, view)).map((entry) => ({ ...entry, stories: shownCards(entry.stories, view) }));
  const projects = [...new Set(shown.map(({ project }) => project))].sort((first, second) => first.localeCompare(second));
  return projects.map((project) => ({ project, epics: shown.filter((entry) => entry.project === project) }));
}

function shownCards(cards: readonly BoardCard[], view: BoardView): BoardCard[] {
  return cards.filter((card) => isShown(card, view)).map((card) => ({ ...card, tasks: shownCards(card.tasks, view) }));
}

function isShown(card: BoardCard, view: BoardView): boolean {
  return card.state === 'closed' ? view.closed : view.open;
}

export function percentDone(entry: BoardEpic): number {
  return entry.total === 0 ? 0 : Math.round((entry.done / entry.total) * 100);
}

export function issueNumberOf(card: BoardCard): string {
  return /\/issues\/(\d+)$/.exec(card.url)?.[1] ?? '';
}
