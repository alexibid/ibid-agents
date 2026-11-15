import { join } from 'node:path';
import type { CoachDesign, CoachGoal, CoachHistoryEntry, CoachPhase, CoachStateValue } from './state.js';

export interface CoachInstruction {
  readonly waitingFor: 'coach-step';
  readonly step: CoachPhase;
  readonly task: string;
  readonly handBack: string;
  readonly contract: string;
  readonly workspaceAgentsFile: string;
  readonly goal: CoachGoal;
  readonly design: CoachDesign;
  readonly lastResult: CoachHistoryEntry | 'none';
}

const TASKS: Readonly<Record<CoachPhase, string>> = {
  'design-outside-in':
    'Read the real HTML template and component under src/. Identify the template problem, design the consumer-first HTML template conceptually (without editing src/), and list any Angular CLI scaffold commands needed.',
  'author-lesson':
    'Author the complete progressive lesson in bite-sized sequential blocks (declarations first, template HTML second, progressive logic third). Never include upfront import statements, never edit src/, and follow all Angular 22 invariants.',
  'await-student':
    'Present the validated lesson to the student and wait for them to write the code. When the student asks you to check their code, submit verify-student-code; when they want the next step, submit next-lesson-step; when finished, submit complete.',
};

const HAND_BACK: Readonly<Record<CoachPhase, string>> = {
  'design-outside-in':
    '{ "inspectedFiles": ["src/..."], "templateProblem": "<what is wrong in current template>", "conceptualTemplate": "<desired consumer-first HTML>", "scaffoldCommands": ["npx ng generate ..."] }',
  'author-lesson':
    '{ "blocks": [{ "phase": "component-declarations" | "directive-declarations" | "template-html" | "progressive-logic", "targetFile": "src/...", "problemAndThought": "...", "codeSnippet": "...", "symbolRoles": ["Symbol: why it exists"], "explanation": "..." }] }',
  'await-student':
    '{ "action": "verify-student-code" | "next-lesson-step" | "complete", "studentFiles": ["src/..."], "verifyBuild": false, "notes": "<optional>" }',
};

export function coachInstruction(step: CoachPhase, state: CoachStateValue): CoachInstruction {
  return {
    waitingFor: 'coach-step',
    step,
    task: TASKS[step],
    handBack: HAND_BACK[step],
    contract: join(state.contractsDirectory, 'coach.md'),
    workspaceAgentsFile: join(state.goal.workspaceRoot, 'AGENTS.md'),
    goal: state.goal,
    design: state.design,
    lastResult: state.history.at(-1) ?? 'none',
  };
}
