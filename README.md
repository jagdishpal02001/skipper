# Skipper AI — YouTube Sponsor Skipper with Ask Gemini + SponsorBlock
🔗 **[Official Website](https://skipperai.octas.solutions/)** | 🛍️ **[Chrome Web Store](https://chromewebstore.google.com/detail/skipper-ai-%E2%80%94-youtube-spon/ncchpipphiigdfbpbjofbhbahcgckaob?utm_source=github&utm_medium=referral&utm_campaign=opensource_discovery)**

[![Website](https://img.shields.io/badge/Website-skipperai.octas.solutions-success)](https://skipperai.octas.solutions/)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-v1.2.0-blue?logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/skipper-ai-%E2%80%94-youtube-spon/ncchpipphiigdfbpbjofbhbahcgckaob?utm_source=github&utm_medium=referral&utm_campaign=opensource_discovery)


Skipper AI is a **free, open-source YouTube sponsor skipper**. It uses **[SponsorBlock](https://sponsor.ajay.app/)** community timestamps, with **optional YouTube AI** for uncovered videos, including fresh uploads when the feature is available. Undo any skip, choose your skip categories, and review time-saved statistics stored on your device.

Core community skipping works without sign-in when segment data is available. AI analysis and comment ratings require an eligible signed-in YouTube account, a supported region and language, and a video offering YouTube's built-in AI feature. Availability and accuracy vary.

**Get started:** install from the Chrome Web Store, reload any YouTube tabs already open, and pin Skipper. Open a supported video; available sponsor segments are skipped automatically.

[Watch the demo](https://www.youtube.com/watch?v=TazPcc1m93o) · [Report a problem](https://github.com/jagdishpal02001/skipper/issues)

> Open a video → Skipper checks its local cache → the SponsorBlock community database and Skipper's shared database (in parallel) → falls back to analyzing via YouTube's built-in Gemini → Skipper skips sponsored segments and shows an alert.

---

## Features

- 🆓 **Free, no API key** — Uses the public **SponsorBlock** database plus YouTube's built-in **"Ask about this video"** Gemini feature (for logged-in accounts that have it) to get sponsor timestamps directly.
- 🌍 **Community coverage without sign-in** — SponsorBlock provides timestamps for covered videos without requiring a Google account.
- 🤖 **Optional AI analysis** — YouTube’s built-in AI can help identify sponsors on uncovered videos when your account and video support it.
- 🎬 **Desktop YouTube watch pages** — Skipping depends on available segment data or eligible YouTube AI. Shorts and livestreams are excluded.
- ⏭️ **Automatic skipping** — Jumps past sponsors, self-promos, intros, and outros.
- 🔔 **Skip alerts** — Non-intrusive notifications each time a segment is skipped, with one-click Undo.
- 🔢 **Toolbar badge** — Pin Skipper and its icon shows how many sponsors it found in the video you're watching.
- 💌 **Share with friends** — Share Skipper — with your own time-saved stats — to WhatsApp, X, Telegram, Facebook, Reddit or email from the popup or dashboard.
- 💬 **AI audience ratings** — A `✦ x/10` badge next to the like/dislike buttons summarizes what viewers think, distilled from the top comments (like-weighted) via YouTube's Gemini. Click it for a positive/negative breakdown and a short summary.
- 📊 **Private time dashboard** — See total time saved, total time on YouTube, your top channels by watch time, browsing-vs-watching split, and Shorts time. All stored **locally** — nothing leaves your device.
- 🧠 **Hybrid cache** — Local results and a shared public cache (Supabase) reduce repeat lookups and AI requests. Available timestamps and derived ratings can be reused by other Skipper users.
- 🎚️ **Granular control** — Per-category toggles for sponsors, self-promo, intros, and outros, plus a toggle for the rating badge.

---

## Tech Stack

Manifest V3 · TypeScript (strict) · React 18 · Vite · TailwindCSS · Chrome Storage API · `@crxjs/vite-plugin` · Supabase REST.

---

## Installation

### 1. Install from Chrome Web Store (Recommended)

You can install Skipper AI directly from the **[Chrome Web Store](https://chromewebstore.google.com/detail/skipper-ai-%E2%80%94-youtube-spon/ncchpipphiigdfbpbjofbhbahcgckaob?utm_source=github&utm_medium=referral&utm_campaign=opensource_discovery)**.

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
[content] ContentController ── Runs the analysis cascade:
   │
   ├── 1. Local Cache check ◀─────┐
   │                              │
   ├── 2. SponsorBlock DB ◀───────┤ (via background message worker)
   │      + Supabase DB, in       │
   │        parallel ◀────────────┤
   │                              │
   ├── 3. AskGeminiProvider ──────┼── AskGeminiApi (same-origin InnerTube API call)
   │      (signed-in users)       └── AskGeminiPanel (DOM interaction fallback driver)
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

- **Cascading Providers.** The extension utilizes a fallback cascade. It checks the local cache first, then queries SponsorBlock and the shared Supabase database in parallel, preferring community timestamps. If all miss, it analyzes the video via the `AskGeminiProvider` using YouTube's built-in Gemini feature and stores the result back to the caches.
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
| Rating badge | on | Show the AI audience rating next to like/dislike |

---

## Privacy

- Optional AI requests and sampled public comments are processed by YouTube's built-in AI feature. No separate AI API key is required.
- SponsorBlock lookups use the privacy-preserving hash-prefix endpoint: only the first four characters of a video ID's SHA-256 hash are sent.
- Requests to the shared Supabase cache use the **full SHA-256 hash** of the video ID rather than its raw ID. Hashing is not a guarantee of anonymity.
- Successful analysis results (sponsor start and end timestamps) are stored in the shared public Supabase database so all Skipper users can benefit from them. Skipper sends no usage telemetry. Local video caches and diagnostic logs may contain video IDs, titles, and channels; settings use Chrome sync.
- **Audience ratings.** Sampled public comments are processed by YouTube's built-in AI. The shared Supabase cache stores the derived rating, sentiment percentages, sample size, and summary under a **SHA-256 hash** of the video ID. Local rating caches also retain the video ID. Shared results do not include the raw comments.
- **Usage dashboard.** Time-tracking statistics (time saved, watch/browse/Shorts time, top channels) are computed and stored **only in `chrome.storage.local` on your own device**. They are never transmitted anywhere, are never associated with an account, and can be cleared any time from the dashboard.

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
