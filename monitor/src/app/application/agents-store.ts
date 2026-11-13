import { computed, inject, Injectable, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { groupedAgents, knownAgentsOf, type AgentRun, type RosterEntry } from '../domain/agent-roster';
import { EMPTY_FLOW_MAP, flowDrawingOf, type FlowMap, type Story } from '../domain/flow-map';
import { keptFresh } from './kept-fresh';
import { MonitorGateway } from './monitor-gateway';

const ALWAYS = signal(true).asReadonly();
const STORIES_SHOWN = 100;
const STORY_FLOW = 'story';
const NO_STORY = '';
const NO_AGENT = '';

@Injectable({ providedIn: 'root' })
export class AgentsStore {
  private readonly gateway = inject(MonitorGateway);

  readonly map = keptFresh<boolean, FlowMap>({
    gateway: this.gateway,
    choice: ALWAYS,
    load: () => this.gateway.flowMap(),
    whileLoading: EMPTY_FLOW_MAP,
  });

  readonly stories = keptFresh<boolean, readonly Story[]>({
    gateway: this.gateway,
    choice: ALWAYS,
    load: () => this.gateway.stories(STORIES_SHOWN),
    whileLoading: [],
  });

  readonly flowId = signal(STORY_FLOW);
  readonly storyId = signal(NO_STORY);

  readonly flow = computed(() => this.map().flows.find((flow) => flow.id === this.flowId()));
  readonly story = computed(() => (this.flowId() === STORY_FLOW ? this.stories().find((story) => story.id === this.storyId()) : undefined));
  readonly drawing = computed(() => {
    const flow = this.flow();
    return flow === undefined ? undefined : flowDrawingOf(flow, this.story());
  });
  readonly catalog = computed(() => [...this.map().agents, ...this.map().skills]);

  private readonly roster = keptFresh<boolean, readonly RosterEntry[]>({
    gateway: this.gateway,
    choice: ALWAYS,
    load: () => this.gateway.agentRoster(),
    whileLoading: [],
  });

  readonly agents = computed(() => knownAgentsOf(this.map().skills, this.roster()));
  readonly groups = computed(() => groupedAgents(this.agents()));
  readonly agentName = signal(NO_AGENT);
  readonly agent = computed(() => this.agents().find((agent) => agent.activityName === this.agentName()));
  removeSkill(name: string): Observable<unknown> {
    return this.gateway.removeSkill(name);
  }

  readonly runs = keptFresh<string, readonly AgentRun[]>({
    gateway: this.gateway,
    choice: this.agentName,
    load: (agent) => this.gateway.agentActivity(agent),
    whileLoading: [],
  });
}
