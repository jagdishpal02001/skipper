import { loadFont as loadJakarta } from '@remotion/google-fonts/PlusJakartaSans';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadRoboto } from '@remotion/google-fonts/Roboto';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';

const jakarta = loadJakarta('normal', { weights: ['500', '600', '700', '800'], subsets: ['latin'] });
const inter = loadInter('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });
const roboto = loadRoboto('normal', { weights: ['400', '500', '700'], subsets: ['latin'] });
const mono = loadMono('normal', { weights: ['400', '500'], subsets: ['latin'] });

/** Same tokens as the website (index.html :root) and tailwind.config.js. */
export const C = {
  bgDeep: '#07090e',
  surface900: '#0f1115',
  surface800: '#171a21',
  surface700: '#1f232c',
  surface600: '#2a2f3a',

  brand400: '#4f9dff',
  brand500: '#2b82f6',
  brand600: '#1a6ae0',
  brand700: '#1657b4',

  geminiCyan: '#22d3ee',
  geminiPurple: '#a855f7',

  sponsor: '#2ecc71',
  selfPromo: '#a855f7',
  intro: '#3b82f6',

  ratingGood: '#2ecc71',
  neutral: '#8b929e',
  ratingPoor: '#e0506a',

  watch: '#3f86d8',
  browse: '#c07d1f',
  shorts: '#d64463',

  ytRed: '#ff0033',

  text: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
} as const;

export const FONT = {
  display: `${jakarta.fontFamily}, ${inter.fontFamily}, system-ui, sans-serif`,
  body: `${inter.fontFamily}, system-ui, sans-serif`,
  /** YouTube's UI font — used for anything that sits "inside" YouTube. */
  ui: `${roboto.fontFamily}, Arial, sans-serif`,
  mono: `${mono.fontFamily}, ui-monospace, monospace`,
};

/** The website's `.gradient-text-ai`. */
export const AI_GRADIENT = 'linear-gradient(120deg, #60a5fa 0%, #c084fc 50%, #22d3ee 100%)';
export const BRAND_GRADIENT = `linear-gradient(135deg, ${C.brand400} 0%, ${C.brand600} 55%, ${C.brand700} 100%)`;
