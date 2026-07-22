# Chrome Web Store listing & privacy copy — v1.1.0

Copy for the CWS Developer Dashboard and the public privacy policy. Written to
satisfy the **single-purpose** and **limited-use / disclosure** policies that
triggered the earlier rejection. Paste into the dashboard fields as marked.

---

## Short description (manifest / ≤132 chars)

> Skip YouTube sponsors, see AI audience ratings from the comments, and track your watch time — private, no API key needed.

---

## Detailed description (Store listing → Description)

**Skipper makes YouTube smarter in three ways — skip the filler, know what viewers think, and understand your own habits.**

⏭️ **Skip sponsors automatically**
Skipper detects and skips sponsored segments, self-promos, intros, and outros. It uses the crowd-sourced SponsorBlock community database (covering millions of videos, no sign-in required) and, for videos not yet covered, YouTube's own built-in "Ask about this video" Gemini feature. No developer API key, no paid subscription.

💬 **See what viewers really think**
A small rating badge appears next to the like/dislike buttons: an AI audience score out of 10, distilled from the video's top comments and weighted by how many likes each comment received — so popular opinions count for more. Click it for a positive / neutral / negative breakdown and a one-line summary. Turn it off any time in settings.

📊 **Track your YouTube time — privately**
An optional dashboard shows how much time Skipper has saved you, how long you spend on YouTube, your top channels by watch time, how much is watching vs. idle browsing, and time spent on Shorts. All of this is stored **only on your device** and never leaves it.

**Privacy first**
- No account, no login to Skipper, no ads, no tracking.
- Your usage statistics stay on your device (`chrome.storage.local`).
- Shared data (sponsor timestamps and audience ratings) is keyed by a one-way SHA-256 hash of the video ID — never the raw ID, your comments, or any identifier that could point back to you.

**Permissions, briefly**
- `storage` — to save your settings and local statistics.
- Access to `youtube.com` — to detect the video, skip segments, read comments for the rating, and draw the badge/timeline. Also `supabase.co` and `sponsor.ajay.app` for the shared sponsor/rating databases.

Sponsor segment data is provided by the SponsorBlock project (CC BY-NC-SA 4.0).

---

## Single purpose (Store listing → "Single purpose" field)

> Skipper enhances the experience of watching a YouTube video: it skips promotional segments, surfaces an AI-summarized audience rating for the video, and shows the user a private, local summary of their own YouTube viewing time. Every feature operates on the YouTube watch experience.

---

## Permission justifications (Privacy practices tab)

**storage**
> Stores the user's settings and their local, on-device usage statistics (time saved, watch time, top channels). None of this data is transmitted off the device.

**Host permission: `https://www.youtube.com/*`**
> The core of the extension. Required to detect the current video, read the player to skip sponsored segments, read the video's public comments to compute the audience rating, and render the rating badge and timeline markers in the page.

**Host permission: `https://*.supabase.co/*`**
> Read/write the shared public database of sponsor timestamps and audience ratings, keyed by a SHA-256 hash of the video ID, so results are instant for all users.

**Host permission: `https://sponsor.ajay.app/*`**
> Look up crowd-sourced sponsor segments from the SponsorBlock community database.

**Remote code**
> No. All logic is bundled in the package; the extension executes no remotely-hosted code.

---

## Data-use disclosures (Privacy practices → checkboxes)

Answer the "What user data do you collect?" section as:

- **Website content** — *Yes.* Reads the current video's page, player state, and public comments to provide skipping and ratings. **Processed transiently; not sold, not used for anything unrelated to the single purpose.**
- **Web history** — *Effectively no off-device collection.* The extension derives per-video and per-channel time statistics, but these are stored **only on the user's device** and are never transmitted. (If the form forces a "collect" answer for on-device processing, disclose it and state it is local-only in the description.)
- Everything else (personally identifiable info, health, financial, authentication, personal communications, location, user activity keystrokes) — **No.**

Check all three certifications:
- ☑️ I do not sell or transfer user data to third parties outside of the approved use cases.
- ☑️ I do not use or transfer user data for purposes unrelated to my item's single purpose.
- ☑️ I do not use or transfer user data to determine creditworthiness or for lending purposes.

---

## Privacy policy (public URL — paste onto your website)

**Skipper — Privacy Policy** (last updated: <DATE>)

Skipper does not collect, sell, or share personal information. There is no account and no login to Skipper itself.

**Data stored on your device only.** Your settings and usage statistics — time saved, time spent watching, browsing, and on Shorts, and your top channels by watch time — are stored locally in your browser (`chrome.storage.local`). This information never leaves your device, is never sent to us or any third party, and can be cleared at any time from the dashboard's "Reset stats" button or by removing the extension.

**Shared, anonymized video data.** To make sponsor-skipping and audience ratings fast for everyone, Skipper contributes two kinds of results to a shared public database (Supabase):
1. Sponsor segment timestamps for a video.
2. An audience-sentiment verdict for a video — a 0–10 rating, positive/negative/neutral percentages, and a short summary generated from the video's public comments.

Each record is keyed by a **one-way SHA-256 hash of the YouTube video ID**. The raw video ID, the comment text, your identity, your IP-linked account, and your watch history are **never** transmitted or stored. These records describe *videos*, not *people*, and cannot be traced back to any individual user.

**Third-party services.** Skipper reads the current YouTube page and its comments same-origin, and uses YouTube's own built-in "Ask about this video" (Gemini) feature to analyze content. It queries the SponsorBlock community database (using a privacy-preserving hash prefix) and the shared Supabase database described above. Skipper uses no developer API keys and runs no remotely-hosted code.

**Contact.** Questions: <YOUR CONTACT EMAIL>.

---

## Post-publish cleanup note (not user-facing)

The shared `sentiment` Supabase table has no automatic expiry. Add a scheduled
job (Supabase cron / pg_cron) to delete rows older than ~30 days — the extension
already ignores verdicts older than 14 days, so this only trims dead weight:

```sql
delete from public.sentiment where created_at < now() - interval '30 days';
```
