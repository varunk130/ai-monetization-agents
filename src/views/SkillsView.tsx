import { useState } from 'react';
import { SKILLS } from '../agent/skills';
import { AGENTS } from '../network/agents';
import { Markdown } from '../components/Markdown';

export function SkillsView() {
  const names = Object.keys(SKILLS).sort();
  const [open, setOpen] = useState(names[0]);
  const users = (skill: string) => Object.values(AGENTS).filter((a) => a.skills.includes(skill));
  const s = SKILLS[open];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Skills and agents</h1>
          <p>
            Each skill is a SKILL.md file: a name, a one-line description agents see up front, and instructions they load only when needed. The same
            files work as Claude Code skills.
          </p>
        </div>
      </div>
      <div className="split">
        <section className="card">
          <div className="card-head">
            <h2>{names.length} skills</h2>
          </div>
          <ul className="roster">
            {names.map((n) => (
              <li key={n}>
                <button className={`skill-row${n === open ? ' on' : ''}`} onClick={() => setOpen(n)}>
                  <code>{n}</code>
                  <span className="cell-sub">{SKILLS[n].description}</span>
                  <span className="cell-sub">Used by {users(n).map((a) => a.name).join(', ')}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>
                <code>skills/{s.name}/SKILL.md</code>
              </h2>
              <p>{s.description}</p>
            </div>
          </div>
          <div className="card-pad">
            <Markdown text={s.body} />
          </div>
          <div className="card-head" style={{ borderTop: '1px solid var(--line)' }}>
            <h2>Agents with this skill</h2>
          </div>
          <div className="card-pad stack" style={{ gap: 10 }}>
            {users(s.name).map((a) => (
              <div key={a.id}>
                <strong>{a.name}</strong> <span className="muted">· {a.org}</span>
                <div className="small ink2">Tools: {a.tools.map((t) => <code key={t} style={{ marginRight: 8 }}>{t}</code>)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
