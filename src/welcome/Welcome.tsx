import { SharePanel } from '@/components';

const STEPS = [
  {
    title: 'Pin Skipper to your toolbar',
    body:
      'Click the puzzle-piece icon at the top right of Chrome, then the pin ' +
      'next to Skipper. Its icon shows how many sponsors it found in the ' +
      "video you're watching, and a click opens your settings and stats.",
  },
  {
    title: 'Sign in to YouTube for the AI extras (optional)',
    body:
      'Skipping works for everyone using the SponsorBlock community database. ' +
      "Signed in, Skipper also uses YouTube's built-in Gemini to find sponsors " +
      'in videos nobody has covered yet, and shows an ✦ audience rating from ' +
      'the comments next to the like button.',
  },
  {
    title: 'Watch anything',
    body:
      'Sponsor reads are skipped automatically, with a small notice and an ' +
      'Undo button. Choose what to skip — sponsors, self-promo, intros, ' +
      'outros — from the toolbar popup.',
  },
];

/**
 * First-run page, opened once on install. Users who pin Skipper and know what
 * signing in adds get far more out of it, so it covers exactly that — then
 * offers sharing while enthusiasm is highest.
 */
export function Welcome() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <header className="mb-8 text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-bold text-white">
          S
        </span>
        <h1 className="text-2xl font-bold text-white">Skipper is ready 🎉</h1>
        <p className="mt-2 text-sm text-gray-400">
          Sponsor segments on YouTube now get skipped automatically. Three quick
          tips to get the most out of it:
        </p>
      </header>

      <ol className="flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-xl border border-white/5 bg-surface-800 p-4"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/20 text-sm font-bold text-brand-400">
              {i + 1}
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white">{step.title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-400">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 text-center">
        <a
          href="https://www.youtube.com/"
          className="inline-block rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          Open YouTube
        </a>
      </div>

      <section className="mt-10 rounded-xl border border-white/5 bg-surface-800 p-4">
        <h2 className="text-sm font-semibold text-white">
          Know someone tired of sponsor reads?
        </h2>
        <p className="mb-3 mt-0.5 text-xs text-gray-400">
          Skipper is free — share it with a friend.
        </p>
        <SharePanel />
      </section>

      <p className="mt-6 text-center text-[11px] text-gray-500">
        Your watch-time stats stay on this device. No account or API key needed.
      </p>
    </div>
  );
}
