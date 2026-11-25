import type { ReactNode } from 'react';

/** Small Markdown renderer for agent output: headings, lists, tables, bold, paragraphs. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  );
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(level === 1 ? <h3 key={i} className="md-h1">{inline(h[2])}</h3> : <h4 key={i} className="md-h2">{inline(h[2])}</h4>);
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[\s:|-]+\|$/.test(lines[i])) rows.push(lines[i].slice(1, -1).split('|').map((c) => c.trim()));
        i++;
      }
      const [head, ...body] = rows;
      if (!head) continue; // separator lines only: nothing to render
      out.push(
        <div className="table-wrap md-table" key={`t${i}`}>
          <table>
            <thead>
              <tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, k) => (
                <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const isUl = (l: string) => /^\s*[-•]\s+/.test(l);
    const isOl = (l: string) => /^\s*\d+\.\s+/.test(l);
    if (isUl(line) || isOl(line)) {
      const ordered = isOl(line);
      const items: string[] = [];
      const same = (l: string | undefined) => l !== undefined && (ordered ? isOl(l) : isUl(l));
      while (i < lines.length) {
        if (same(lines[i])) {
          items.push(lines[i].replace(/^\s*([-•]|\d+\.)\s+/, ''));
          i++;
        } else if (!lines[i].trim() && same(lines[i + 1])) {
          i++; // blank line between items of the same list
        } else break;
      }
      const List = ordered ? 'ol' : 'ul';
      out.push(<List key={`l${i}`} className="md-list">{items.map((it, k) => <li key={k}>{inline(it)}</li>)}</List>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\||\s*[-•]\s|\s*\d+\.\s)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(<p key={`p${i}`} className="md-p">{para.flatMap((p, k) => (k ? [<br key={`b${k}`} />, ...inline(p)] : inline(p)))}</p>);
  }
  return <div className="md">{out}</div>;
}
