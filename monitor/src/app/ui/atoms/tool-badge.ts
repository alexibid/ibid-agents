import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TOOL_NAMES, type Tool } from '../../domain/prompt';

@Component({
  selector: 'monitor-tool-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'badge badge--' + tool()">{{ name() }}</span>`,
  styleUrl: './tool-badge.scss',
})
export class ToolBadge {
  readonly tool = input.required<Tool | 'langgraph'>();

  protected readonly name = computed(() => {
    const tool = this.tool();
    return tool === 'langgraph' ? 'LangGraph' : TOOL_NAMES[tool];
  });
}
