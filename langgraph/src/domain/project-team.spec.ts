import { describe, expect, it } from 'vitest';
import { agentsJoining, type ProjectAgent } from './project-team.js';

const blender: ProjectAgent = { agent: 'blender', step: 'implement', when: 'figures', contract: 'skills/blender/SKILL.md' };
const designer: ProjectAgent = { agent: 'web-design', step: 'plan', when: 'always', contract: 'skills/web-design/SKILL.md' };

describe('agentsJoining', () => {
  it('should bring a project agent into its step only when its condition holds', () => {
    expect(agentsJoining('implement', ['figures'], [blender, designer])).toEqual([blender]);
    expect(agentsJoining('implement', ['ui'], [blender, designer])).toEqual([]);
  });

  it('should bring an always agent into its own step and no other', () => {
    expect(agentsJoining('plan', [], [blender, designer])).toEqual([designer]);
    expect(agentsJoining('review', ['figures'], [blender, designer])).toEqual([]);
  });
});
