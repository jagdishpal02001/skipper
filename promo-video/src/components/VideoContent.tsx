import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, FONT } from '../theme';
import { clamp } from '../lib/anim';
import { Icon } from './Icons';
import type { IconName } from './Icons';

/* ------------------------------------------------------------------------ *
 * A fake coding tutorial — the "video" playing inside the mock player.
 * Which file is on screen, and how much of it is typed, follows the *video*
 * clock, so time-lapses and skips visibly change what's playing.
 * ------------------------------------------------------------------------ */

interface CodeFile {
  name: string;
  from: number;
  to: number;
  lines: string[];
}

export const CODE_FILES: CodeFile[] = [
  {
    name: 'Button.tsx',
    from: 0,
    to: 222,
    lines: [
      "import { forwardRef } from 'react';",
      "import { cva } from './variants';",
      '',
      "const button = cva('btn', {",
      '  variants: {',
      "    intent: { primary: 'btn-primary', ghost: 'btn-ghost' },",
      "    size: { sm: 'h-8 px-3', md: 'h-10 px-4' },",
      '  },',
      '});',
      '',
      'export const Button = forwardRef((props, ref) => (',
      '  <button ref={ref} className={button(props)} {...props} />',
      '));',
    ],
  },
  {
    name: 'tokens.ts',
    from: 297,
    to: 555,
    lines: [
      'export const tokens = {',
      '  color: {',
      "    brand: { 500: '#2b82f6', 600: '#1a6ae0' },",
      "    surface: { 800: '#171a21', 900: '#0f1115' },",
      '  },',
      '  radius: { sm: 8, md: 12, lg: 20 },',
      '  space: (n: number) => `${n * 4}px`,',
      '};',
      '',
      'export type Tokens = typeof tokens;',
    ],
  },
  {
    name: 'Card.tsx',
    from: 598,
    to: 750,
    lines: [
      "import { tokens } from './tokens';",
      '',
      'export function Card({ title, children }) {',
      '  return (',
      '    <section style={{ borderRadius: tokens.radius.md }}>',
      '      <h2>{title}</h2>',
      '      {children}',
      '    </section>',
      '  );',
      '}',
    ],
  },
];

const KEYWORDS = new Set([
  'import',
  'from',
  'const',
  'export',
  'return',
  'function',
  'type',
  'typeof',
  'number',
]);

const SYNTAX = {
  keyword: '#c678dd',
  string: '#98c379',
  fn: '#61afef',
  type: '#e5c07b',
  prop: '#e06c75',
  number: '#d19a66',
  punct: '#8b95a7',
  plain: '#d7dae0',
  tag: '#e06c75',
};

type Token = { text: string; color: string };

const tokenize = (line: string): Token[] => {
  const out: Token[] = [];
  const re = /('[^']*'|`[^`]*`)|(\b\d+\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z_$\d'`]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const [text, str, num, ident, space] = m;
    if (str) out.push({ text, color: SYNTAX.string });
    else if (num) out.push({ text, color: SYNTAX.number });
    else if (ident) {
      const rest = line.slice(re.lastIndex);
      const prev = line.slice(0, m.index);
      let color: string = SYNTAX.plain;
      if (KEYWORDS.has(ident)) color = SYNTAX.keyword;
      else if (prev.endsWith('<') || prev.endsWith('</')) color = SYNTAX.tag;
      else if (/^\s*\(/.test(rest)) color = SYNTAX.fn;
      else if (/^[A-Z]/.test(ident)) color = SYNTAX.type;
      else if (/^\s*:/.test(rest) || /^\s*=\{/.test(rest)) color = SYNTAX.prop;
      out.push({ text, color });
    } else if (space) out.push({ text, color: SYNTAX.plain });
    else out.push({ text, color: SYNTAX.punct });
  }
  return out;
};

const fileAt = (videoTime: number): CodeFile => {
  for (let i = CODE_FILES.length - 1; i >= 0; i--) {
    const f = CODE_FILES[i]!;
    if (videoTime >= f.from) return f;
  }
  return CODE_FILES[0]!;
};

const SideItem: React.FC<{ icon: IconName; label: string; depth: number; active?: boolean }> = ({
  icon,
  label,
  depth,
  active,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 30,
      paddingLeft: 14 + depth * 14,
      fontSize: 15,
      color: active ? '#fff' : '#8b95a7',
      background: active ? 'rgba(79,157,255,0.14)' : undefined,
      borderLeft: active ? `2px solid ${C.brand400}` : '2px solid transparent',
    }}
  >
    <Icon name={icon} size={15} color={active ? C.brand400 : '#6b7385'} />
    {label}
  </div>
);

/** Webcam bubble of the (fictional) creator, gently "talking". */
export const Webcam: React.FC<{ size: number; t: number; style?: React.CSSProperties }> = ({
  size,
  t,
  style,
}) => {
  const bob = Math.sin(t * 9) * 0.012 + Math.sin(t * 3.1) * 0.01;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        background: 'radial-gradient(circle at 30% 25%, #3b3f8f 0%, #1c1f4a 55%, #111330 100%)',
        border: '3px solid rgba(255,255,255,0.85)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        ...style,
      }}
    >
      {/* Soft key light */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 75% 20%, rgba(255,190,140,0.35), transparent 50%)',
        }}
      />
      {/* Shoulders */}
      <div
        style={{
          position: 'absolute',
          left: '12%',
          right: '12%',
          bottom: '-22%',
          height: '52%',
          borderRadius: '50% 50% 0 0',
          background: 'linear-gradient(180deg, #e8eaf2 0%, #b9bfd0 100%)',
          transform: `translateY(${bob * size}px)`,
        }}
      />
      {/* Head */}
      <div
        style={{
          position: 'absolute',
          left: '33%',
          width: '34%',
          height: '38%',
          top: '20%',
          borderRadius: '46% 46% 44% 44%',
          background: 'linear-gradient(180deg, #f2c7a5 0%, #d9a07c 100%)',
          transform: `translateY(${bob * size * 1.4}px) rotate(${Math.sin(t * 2.3) * 3}deg)`,
        }}
      >
        {/* Hair */}
        <div
          style={{
            position: 'absolute',
            left: '-6%',
            right: '-6%',
            top: '-10%',
            height: '42%',
            borderRadius: '50% 50% 30% 30%',
            background: '#2b2238',
          }}
        />
      </div>
    </div>
  );
};

export const TutorialFrame: React.FC<{ videoTime: number; t: number }> = ({ videoTime, t }) => {
  const file = fileAt(videoTime);
  const total = file.lines.reduce((n, l) => n + l.length + 1, 0);
  const typed = Math.floor(clamp((videoTime - file.from) / ((file.to - file.from) * 0.8)) * total);

  let budget = typed;
  const caretOn = Math.floor(t * 2.2) % 2 === 0;

  return (
    <AbsoluteFill style={{ background: '#0b0e14', fontFamily: FONT.body, display: 'flex', flexDirection: 'row' }}>
      {/* Activity bar */}
      <div
        style={{
          width: 56,
          background: '#080a0f',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
          paddingTop: 92,
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <Icon name="fileCode" size={24} color="#e6e9ef" />
        <Icon name="search" size={24} color="#5c6370" />
        <Icon name="gitBranch" size={24} color="#5c6370" />
      </div>
      {/* Explorer */}
      <div
        style={{
          width: 220,
          background: '#0d1017',
          paddingTop: 84,
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: '0.12em', color: '#6b7385', padding: '0 16px 10px' }}>
          EXPLORER
        </div>
        <SideItem icon="folder" label="src" depth={0} />
        <SideItem icon="folder" label="components" depth={1} />
        {CODE_FILES.map((f) => (
          <SideItem key={f.name} icon="fileCode" label={f.name} depth={2} active={f === file} />
        ))}
        <SideItem icon="fileCode" label="index.ts" depth={1} />
      </div>
      {/* Editor */}
      <div style={{ flex: 1, position: 'relative', paddingTop: 72 }}>
        <div style={{ display: 'flex', height: 40, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[file.name, 'variants.ts'].map((name, i) => (
            <div
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 18px',
                fontSize: 15,
                color: i === 0 ? '#fff' : '#6b7385',
                background: i === 0 ? '#0b0e14' : '#090b10',
                borderTop: i === 0 ? `2px solid ${C.brand400}` : '2px solid transparent',
                borderRight: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <Icon name="fileCode" size={14} color={i === 0 ? C.brand400 : '#5c6370'} />
              {name}
            </div>
          ))}
        </div>
        <div style={{ padding: '18px 0 0 0', fontFamily: FONT.mono, fontSize: 19, lineHeight: '31px' }}>
          {file.lines.map((line, li) => {
            const visible = Math.max(0, Math.min(line.length, budget));
            const isCaretLine = budget >= 0 && budget <= line.length;
            budget -= line.length + 1;
            const shown = line.slice(0, visible);
            return (
              <div key={li} style={{ display: 'flex', whiteSpace: 'pre' }}>
                <span style={{ width: 58, textAlign: 'right', paddingRight: 22, color: '#3b4252' }}>
                  {li + 1}
                </span>
                <span>
                  {tokenize(shown).map((tok, ti) => (
                    <span key={ti} style={{ color: tok.color }}>
                      {tok.text}
                    </span>
                  ))}
                  {isCaretLine && caretOn ? (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 2,
                        height: 22,
                        background: C.brand400,
                        verticalAlign: 'middle',
                        marginLeft: 1,
                      }}
                    />
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
        <Webcam size={150} t={t} style={{ position: 'absolute', right: 34, bottom: 120 }} />
      </div>
    </AbsoluteFill>
  );
};

/** The sponsor read that Skipper never lets you sit through. */
export const SponsorFrame: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill
    style={{
      background: 'radial-gradient(ellipse at 30% 40%, #14402a 0%, #0a1f15 55%, #06110b 100%)',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 56,
      fontFamily: FONT.display,
    }}
  >
    <Webcam size={250} t={t} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.2em', color: '#7ee2a8' }}>
        THIS VIDEO IS SPONSORED BY
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #2ecc71, #16a085)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name="shield" size={36} color="#062012" strokeWidth={2.4} />
        </div>
        <div style={{ width: 300, height: 46, borderRadius: 12, background: 'rgba(255,255,255,0.88)' }} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: '#d8f5e4', fontFamily: FONT.body }}>
        Use code <span style={{ background: '#d8f5e4', color: 'transparent', borderRadius: 6 }}>XXXXXX</span> for 20% off
      </div>
    </div>
  </AbsoluteFill>
);

/** The merch plug. */
export const PromoFrame: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill
    style={{
      background: 'radial-gradient(ellipse at 70% 40%, #3a1a5c 0%, #1d0e30 55%, #0f0719 100%)',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 48,
      fontFamily: FONT.display,
    }}
  >
    <div
      style={{
        width: 210,
        height: 210,
        borderRadius: 36,
        background: 'linear-gradient(135deg, #a855f7, #6d28d9)',
        display: 'grid',
        placeItems: 'center',
        transform: `rotate(${Math.sin(t * 3) * 4}deg)`,
      }}
    >
      <Icon name="shirt" size={120} color="#fff" strokeWidth={1.6} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.2em', color: '#d8b4fe' }}>
        NEW MERCH DROP
      </div>
      <div style={{ fontSize: 52, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
        Link in the description!
      </div>
    </div>
  </AbsoluteFill>
);
