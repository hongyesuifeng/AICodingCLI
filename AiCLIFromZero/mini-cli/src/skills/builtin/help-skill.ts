// src/skills/builtin/help-skill.ts
// 帮助技能

import { BaseSkill } from '../base-skill.js';
import { SkillContext, SkillResult } from '../types.js';
import { SkillRegistry } from '../skill-registry.js';

/**
 * Help 技能
 * 显示技能帮助信息
 */
export class HelpSkill extends BaseSkill {
  name = 'help';
  description = 'Show help for skills';

  private registry: SkillRegistry;

  constructor(registry: SkillRegistry) {
    super();
    this.registry = registry;
  }

  triggers = [{ command: 'help', priority: 100 }];

  parameters = [
    {
      name: 'skill',
      description: 'Skill name to get help for',
      required: false,
    },
  ];

  examples = ['/help', '/help commit'];

  async execute(context: SkillContext, args?: Record<string, any>): Promise<SkillResult> {
    const skillName = args?.skill;

    if (skillName) {
      const skill = this.registry.get(skillName);
      if (skill) {
        let help = `/${skill.name} - ${skill.description}\n`;

        if (skill.help) {
          help += `\n${skill.help}\n`;
        }

        if (skill.parameters?.length) {
          help += '\nParameters:\n';
          for (const param of skill.parameters) {
            const required = param.required ? '(required)' : '(optional)';
            help += `  ${param.name} ${required} - ${param.description || ''}\n`;
          }
        }

        if (skill.examples?.length) {
          help += '\nExamples:\n';
          for (const example of skill.examples) {
            help += `  ${example}\n`;
          }
        }

        return { success: true, output: help };
      }
      return {
        success: false,
        output: `Unknown skill: ${skillName}`,
      };
    }

    // 显示所有技能
    const skills = this.registry.list();
    let output = 'Available skills:\n\n';

    for (const skill of skills) {
      output += `  /${skill.name.padEnd(15)} - ${skill.description}\n`;
    }

    output += '\nUse /help <skill-name> for more details.';

    return { success: true, output };
  }
}
