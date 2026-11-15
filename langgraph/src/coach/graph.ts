import { access } from 'node:fs/promises';
import { END, START, StateGraph, interrupt, type BaseCheckpointSaver } from '@langchain/langgraph';
import { WorkspaceChanges } from '../checks/workspace-changes.js';
import { validateDesign, validateLesson, validateStudentAction } from './checks.js';
import { coachInstruction } from './instructions.js';
import { CoachState, type CoachStateUpdate, type CoachStateValue } from './state.js';

export interface CoachGraphDependencies {
  readonly contractsDirectory: string;
}

export function buildCoachGraph(
  { contractsDirectory }: CoachGraphDependencies,
  checkpointer?: BaseCheckpointSaver,
) {
  async function intakeNode(state: CoachStateValue): Promise<CoachStateUpdate> {
    await access(state.goal.workspaceRoot);
    const baseline = await new WorkspaceChanges(state.goal.workspaceRoot).fingerprint();
    return { contractsDirectory, baseline, status: 'designing' };
  }

  async function designNode(state: CoachStateValue): Promise<CoachStateUpdate> {
    const raw: unknown = interrupt(coachInstruction('design-outside-in', state));
    const verdict = await validateDesign(raw, state.goal.workspaceRoot, state.baseline);
    if (!verdict.result.passed || verdict.design === undefined) {
      return {
        status: 'designing',
        history: [{ step: 'design-outside-in', passed: false, details: verdict.result.details }],
      };
    }
    return {
      design: verdict.design,
      status: 'authoring-lesson',
      history: [{ step: 'design-outside-in', passed: true, details: [] }],
    };
  }

  async function lessonNode(state: CoachStateValue): Promise<CoachStateUpdate> {
    const raw: unknown = interrupt(coachInstruction('author-lesson', state));
    const verdict = await validateLesson(raw, state.goal.workspaceRoot, state.baseline);
    if (!verdict.result.passed || verdict.blocks === undefined) {
      return {
        status: 'authoring-lesson',
        history: [{ step: 'author-lesson', passed: false, details: verdict.result.details }],
      };
    }
    return {
      blocks: [...verdict.blocks],
      status: 'awaiting-student',
      history: [{ step: 'author-lesson', passed: true, details: [] }],
    };
  }

  async function studentNode(state: CoachStateValue): Promise<CoachStateUpdate> {
    const raw: unknown = interrupt(coachInstruction('await-student', state));
    const verdict = await validateStudentAction(raw, state.goal.workspaceRoot, state.baseline);
    if (!verdict.result.passed || verdict.action === undefined) {
      return {
        status: 'awaiting-student',
        history: [{ step: 'await-student', passed: false, details: verdict.result.details }],
      };
    }
    if (verdict.action.action === 'next-lesson-step') {
      const baseline = await new WorkspaceChanges(state.goal.workspaceRoot).fingerprint();
      return {
        baseline,
        status: 'authoring-lesson',
        history: [{ step: 'await-student', passed: true, details: verdict.result.details }],
      };
    }
    return {
      status: verdict.action.action === 'complete' ? 'finished' : 'awaiting-student',
      history: [{ step: 'await-student', passed: true, details: verdict.result.details }],
    };
  }

  const afterDesign = (state: CoachStateValue) =>
    state.status === 'authoring-lesson' ? 'author-lesson' : 'design-outside-in';
  const afterLesson = (state: CoachStateValue) =>
    state.status === 'awaiting-student' ? 'await-student' : 'author-lesson';
  const afterStudent = (state: CoachStateValue) =>
    state.status === 'finished' ? END : state.status === 'authoring-lesson' ? 'author-lesson' : 'await-student';

  return new StateGraph(CoachState)
    .addNode('intake', intakeNode)
    .addNode('design-outside-in', designNode)
    .addNode('author-lesson', lessonNode)
    .addNode('await-student', studentNode)
    .addEdge(START, 'intake')
    .addEdge('intake', 'design-outside-in')
    .addConditionalEdges('design-outside-in', afterDesign, ['design-outside-in', 'author-lesson'])
    .addConditionalEdges('author-lesson', afterLesson, ['author-lesson', 'await-student'])
    .addConditionalEdges('await-student', afterStudent, ['await-student', 'author-lesson', END])
    .compile(checkpointer === undefined ? {} : { checkpointer });
}

export type CoachGraph = ReturnType<typeof buildCoachGraph>;
