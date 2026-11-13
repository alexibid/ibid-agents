import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { nameOf, NODE_WIDTH, type FlowDrawing } from '../../domain/flow-map';

const NODE_TOP = 24;
const NODE_HEIGHT = 56;
const AGENT_TOP = 100;
const REPAIR_DEPTH = 18;
const REPAIR_LANES = 4;
const BELOW_CONTRACTS = AGENT_TOP + 66;

@Component({
  selector: 'monitor-flow-diagram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flow-diagram.html',
  styleUrl: './flow-diagram.scss',
})
export class FlowDiagram {
  readonly drawing = input.required<FlowDrawing>();
  readonly nodePicked = output<string>();

  protected readonly nameOf = nameOf;
  protected readonly nodeWidth = NODE_WIDTH;
  protected readonly nodeTop = NODE_TOP;
  protected readonly nodeHeight = NODE_HEIGHT;
  protected readonly agentTop = AGENT_TOP;
  protected readonly middle = NODE_TOP + NODE_HEIGHT / 2;
  protected readonly height = BELOW_CONTRACTS + REPAIR_DEPTH * (REPAIR_LANES + 1);

  protected centreOf(position: number): number {
    return (this.drawing().nodes[position]?.x ?? 0) + NODE_WIDTH / 2;
  }

  protected repairPath(from: number, to: number, order: number): string {
    const start = this.centreOf(from);
    const end = this.centreOf(to);
    const bottom = BELOW_CONTRACTS + REPAIR_DEPTH * (1 + (order % REPAIR_LANES));
    return `M ${start} ${BELOW_CONTRACTS} C ${start} ${bottom}, ${end} ${bottom}, ${end} ${BELOW_CONTRACTS}`;
  }
}
