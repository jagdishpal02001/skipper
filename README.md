# Skipper — AI Sponsor Skip for YouTube

🔗 **[Official Website](https://skipperai.netlify.app/)** | 🛍️ **[Chrome Web Store](https://chromewebstore.google.com/detail/skipper-ai-%E2%80%94-youtube-spon/ncchpipphiigdfbpbjofbhbahcgckaob)**

[![Website](https://img.shields.io/badge/Website-skipperai.netlify.app-success)](https://skipperai.netlify.app/)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-v1.0.2-blue?logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/skipper-ai-%E2%80%94-youtube-spon/ncchpipphiigdfbpbjofbhbahcgckaob)


Skipper automatically detects and skips sponsored segments in YouTube videos. It combines the crowd-sourced **[SponsorBlock](https://sponsor.ajay.app/)** community database — which covers millions of videos and needs no sign-in — with on-demand **Gemini AI** analysis for videos the community hasn't covered yet (including ones uploaded minutes ago).

> Open a video → Skipper checks the local cache & Supabase public database → SponsorBlock community database → Falls back to analyzing via YouTube's built-in Gemini → Skipper skips sponsored segments and shows an alert.

---

## Features

- 🆓 **Free, no API key** — Uses the public **SponsorBlock** database plus YouTube's built-in **"Ask about this video"** Gemini feature (for logged-in accounts that have it) to get sponsor timestamps directly.
- 🌍 **Reliable out of the box** — SponsorBlock covers millions of videos and works without any Google sign-in, so skipping works immediately.
- 🤖 **On-demand AI analysis** — Gemini fills the gaps for videos not yet in the community database — no manual submissions required.
- 🎬 **Works on any video** — Transcript, captions, chapters, description, or comments are used as the analysis source.
- ⏭️ **Automatic skipping** — Jumps past sponsors, self-promos, intros, and outros.
- 🔔 **Skip alerts** — Non-intrusive notifications each time a segment is skipped.
- 🧠 **Hybrid cache** — Uses a 30-day local cache (`chrome.storage.local`) combined with a shared public database (Supabase) so once any video is analyzed, all other Skipper users skip it instantly.
- 🎚️ **Granular control** — Per-category toggles for sponsors, self-promo, intros, and outros.

---

## Tech Stack

Manifest V3 · TypeScript (strict) · React 18 · Vite · TailwindCSS · Chrome Storage API · `@crxjs/vite-plugin` · Supabase REST.

---

## Installation

### 1. Install from Chrome Web Store (Recommended)

You can install Skipper AI directly from the **[Chrome Web Store](https://chromewebstore.google.com/detail/skipper-ai-%E2%80%94-youtube-spon/ncchpipphiigdfbpbjofbhbahcgckaob)**.

### 2. Manual Installation & Build (For Developers)

To build the extension from source:

```bash
# 1. Install dependencies
npm install

# 2. Build the extension (icons are generated automatically)
npm run build
```

The build output lands in `dist/`. Load it into Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the `dist/` folder.
4. Open any YouTube video — analysis runs automatically.

### Development (hot reload)

```bash
npm run dev
```

---

## How It Works

```
YouTube video loaded
   │
   ▼
[content] VideoDetector ───── Detects video ID changes (SPA-aware)
   │
   ▼
[content] YouTubeData ──────── Extracts watch page metadata and caption tracks
   │
   ▼
[content] TranscriptService ── Cascades through: manual captions → auto captions →
   │                           chapters → description → comments to assemble source text
   │
   ▼
[content] ContentController ── Runs the analysis cascade:
   │
   ├── 1. Local Cache check ◀─┐
   │                          │
   ├── 2. Supabase DB check ◀─┤
   │                          ├── (via background message worker)
   ├── 3. SponsorBlock DB ◀───┤
   │                          │
   ├── 4. AskGeminiProvider ──┼── AskGeminiApi (same-origin InnerTube API call)
   │                          └── AskGeminiPanel (DOM interaction fallback driver)
   │
   ▼ (segments handed to the skip engine)
[content] SponsorSkipEngine ── Monitors playback, skips active segments,
                               emits events to paint timeline markers & show toasts
```

---

## Project Structure

```
src/
├── background/      Service worker message hub (index.ts)
├── content/         Content script
│   ├── ContentController.ts   ← orchestrates detection, analysis, and skipping
│   ├── index.tsx              ← boots content services and mounts the toast host
│   ├── services/
│   │   ├── AskGeminiApi.ts    ← same-origin InnerTube API communicator
│   │   ├── AskGeminiPanel.ts  ← DOM driver for the Gemini chat panel (fallback)
│   │   └── TimelineMarkers.ts ← draws sponsor bar overlays on the player timeline
│   └── widget/                ← skip toast overlay UI components
├── popup/           Extension popup React UI and configuration panels
├── providers/       SegmentProvider registry (Community lookup / AskGemini)
├── services/        SponsorSkipEngine, TranscriptService, VideoDetector,
│                    YouTubeData, YouTubePlayer, and supabase clients
├── storage/         chrome.storage repository wrappers (cache & settings)
├── hooks/           React state hooks for settings, cache info, and active video
├── components/      Reusable popup UI components (Button, Card, Toggle, etc.)
├── utils/           Logger, time formatting, messaging, and protobuf helpers
└── types/           Shared TypeScript type definitions
```

---

## Key Architecture Patterns

- **Cascading Providers.** The extension utilizes a fallback cascade. It checks the local cache first, then queries the public databases (Supabase, then SponsorBlock). If all miss, it analyzes the video via the `AskGeminiProvider` using YouTube's built-in Gemini feature and stores the result back to the caches.
- **Repository Pattern.** Storage wrappers (`SegmentCacheRepository`, `SettingsRepository`) decouple the application logic from the raw Chrome storage APIs, keeping code mockable and clean.
- **Shadow DOM Isolation.** In-player toast overlays are mounted in an isolated Shadow DOM so YouTube's styles cannot interfere with the extension's rendering.
- **Efficient Event Loops.** Skipping reads the native HTML5 `<video>` element directly. We query `currentTime` in a lightweight periodic loop, auto-cleaning resources on navigation or tab unload.

---

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| Enabled | on | Master switch |
| Auto-analyze | on | Analyze each video on load |
| Show alerts | on | Toast when a segment is skipped |
| Skip Sponsors | on | Ads, affiliate plugs, VPNs, courses, promo codes |
| Skip Self-Promo | on | Creator merchandise, Patreon, channel self-plugs |
| Skip Intros | off | Branded intro sequences |
| Skip Outros | off | End cards and outro credits |

---

## Privacy

- Video transcripts and metadata are parsed same-origin and analyzed through YouTube's built-in Gemini feature. No developer API keys are used or stored.
- SponsorBlock lookups use the privacy-preserving hash-prefix endpoint: only the first four characters of a video ID's SHA-256 hash are sent.
- The shared Supabase cache is keyed by the **full SHA-256 hash** of the video ID, so the raw ID of the video you are watching is never transmitted.
- Successful analysis results (sponsor start and end timestamps) are stored in the shared public Supabase database so all Skipper users can benefit from them. No persistent identifier, account info, or watch history is collected, and no usage telemetry is sent.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server with Hot Module Replacement (HMR) |
| `npm run build` | Production compile and bundle output to `dist/` |
| `npm run lint` | ESLint static analysis |
| `npm run format` | Prettier code formatter |
| `npm run icons` | Programmatically generate PNG extension icons |

---

## Credits

Sponsor segment data is provided by the **[SponsorBlock](https://sponsor.ajay.app/)** project and its community of contributors, used under the [SponsorBlock database license](https://github.com/ajayyy/SponsorBlock/wiki/Database-and-API-License) (CC BY-NC-SA 4.0).

---

## License

MIT
