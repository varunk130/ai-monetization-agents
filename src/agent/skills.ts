/**
 * Skills are folders with a SKILL.md file: YAML-ish frontmatter (name,
 * description) plus Markdown instructions. Agents see only the one-line
 * descriptions up front and call load_skill to read the full body when they
 * need it (progressive disclosure). The same files work as Claude Code skills.
 */
import type { Skill } from './types';

const files = import.meta.glob('../../skills/*/SKILL.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export function parseSkill(raw: string): Skill {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('SKILL.md is missing frontmatter');
  const meta: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  if (!meta.name || !meta.description) throw new Error('SKILL.md needs name and description');
  return { name: meta.name, description: meta.description, body: m[2].trim() };
}

export const SKILLS: Record<string, Skill> = Object.fromEntries(
  Object.values(files).map((raw) => {
    const s = parseSkill(raw);
    return [s.name, s];
  }),
);

export function skillIndex(names: string[]): string {
  return names
    .map((n) => SKILLS[n])
    .filter(Boolean)
    .map((s) => `- ${s.name}: ${s.description}`)
    .join('\n');
}
