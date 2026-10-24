// Map icons. Each icon is a standalone 24×24 SVG in ./icons/ drawn with
// currentColor; here they become <symbol>s in the map's <defs> so the map can
// <use> them at any size and tint them (e.g. working vs broken systems).

const files = import.meta.glob('./icons/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export type IconName = 'fabricator' | 'generator' | 'relay' | 'core' | 'airlock' | 'husk' | 'warning';

/** The file's drawing, wrapped in a <g> that keeps the root's stroke/fill settings. */
function symbolMarkup(svg: string): string {
  const m = svg.match(/<svg([^>]*)>([\s\S]*)<\/svg>/);
  if (!m) return '';
  const attrs = m[1].replace(/\s(xmlns|viewBox|width|height)="[^"]*"/g, '');
  return `<g${attrs}>${m[2]}</g>`;
}

const SYMBOLS = Object.entries(files).map(([path, svg]) => ({
  name: path.replace(/^.*\/|\.svg$/g, ''),
  markup: symbolMarkup(svg),
}));

/** Put once inside the map <svg>. */
export function IconDefs() {
  return (
    <defs>
      {SYMBOLS.map((s) => (
        <symbol key={s.name} id={`icon-${s.name}`} viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: s.markup }} />
      ))}
    </defs>
  );
}

interface IconProps {
  name: IconName;
  /** Centre of the icon in map coordinates. */
  x: number;
  y: number;
  size: number;
  color: string;
  opacity?: number;
}

export function Icon({ name, x, y, size, color, opacity }: IconProps) {
  return <use href={`#icon-${name}`} x={x - size / 2} y={y - size / 2} width={size} height={size} color={color} opacity={opacity} />;
}
