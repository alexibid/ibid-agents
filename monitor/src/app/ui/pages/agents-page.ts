import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AgentsStore } from '../../application/agents-store';
import { eventsOf, nameOf } from '../../domain/flow-map';
import { Button } from '../atoms/button';
import { ChoiceField, type Choice } from '../atoms/choice-field';
import { Dialog } from '../atoms/dialog';
import { AgentActivity } from '../organisms/agent-activity';
import { AgentList } from '../organisms/agent-list';
import { FlowDiagram } from '../organisms/flow-diagram';
import { StepDetail } from '../organisms/step-detail';

const NO_NODE = '';
const NO_STORY: Choice = { value: '', label: 'Nenhuma: só o mapa' };

@Component({
  selector: 'monitor-agents-page',
  imports: [AgentList, AgentActivity, Button, ChoiceField, Dialog, FlowDiagram, StepDetail],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agents-page.html',
  styleUrl: './agents-page.scss',
})
export class AgentsPage {
  protected readonly store = inject(AgentsStore);
  protected readonly pickedNode = signal(NO_NODE);
  protected readonly nameOf = nameOf;
  protected readonly doomed = signal('');
  protected readonly removalFailure = signal('');

  protected remove(name: string): void {
    this.store.removeSkill(name).subscribe({
      next: () => {
        this.store.agentName.set('');
        this.closeRemoval();
      },
      error: () => this.removalFailure.set('Não foi possível apagar. Só os teus agentes se podem apagar daqui.'),
    });
  }

  protected closeRemoval(): void {
    this.doomed.set('');
    this.removalFailure.set('');
  }

  protected readonly flowChoices = computed<Choice[]>(() => this.store.map().flows.map((flow) => ({ value: flow.id, label: flow.title })));
  protected readonly storyChoices = computed<Choice[]>(() => [
    NO_STORY,
    ...this.store.stories().map((story) => ({ value: story.id, label: `${story.project} · ${story.title}` })),
  ]);
  protected readonly node = computed(() => this.store.flow()?.nodes.find((node) => node.id === this.pickedNode()));
  protected readonly nodeEvents = computed(() => eventsOf(this.pickedNode(), this.store.story()));

  constructor() {
    effect(() => {
      const first = this.store.agents()[0];
      if (this.store.agentName() === '' && first !== undefined) {
        this.store.agentName.set(first.activityName);
      }
    });
  }
}
