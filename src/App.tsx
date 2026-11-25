import { useEffect, useState } from 'react';
import { MissionView } from './views/MissionView';
import { SkillsView } from './views/SkillsView';
import { CaseStudyView } from './views/CaseStudyView';
import { UseCasesView } from './views/UseCasesView';
import { IconAds, IconBrief, IconResults, IconSparkle } from './components/ui';

const NAV = [
  { key: '', href: '#/', label: 'Case study', Icon: IconResults },
  { key: 'agents', href: '#/agents', label: 'Agent missions', Icon: IconSparkle },
  { key: 'use-cases', href: '#/use-cases', label: 'Use cases', Icon: IconAds },
  { key: 'skills', href: '#/skills', label: 'Skills and agents', Icon: IconBrief },
];

const read = () => window.location.hash.replace(/^#\/?/, '').split('/')[0] ?? '';

export function App() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark">RA</span>
          <span>
            Revenue Agents
            <small>Monetization and growth</small>
          </span>
        </div>
        <nav className="nav">
          {NAV.map(({ key, href, label, Icon }) => (
            <a key={key} href={href} aria-current={route === key ? 'page' : undefined}>
              <Icon /> {label}
            </a>
          ))}
        </nav>
        <div className="foot">
          <strong>Demo data.</strong> Companies, platforms, and numbers are fictional. Replay runs offline; live mode uses Claude.
        </div>
      </aside>
      <main className="main">{route === 'skills' ? <SkillsView /> : route === 'agents' ? <MissionView /> : route === 'use-cases' ? <UseCasesView /> : <CaseStudyView />}</main>
    </div>
  );
}
