# Releasing Skipper v1.2.0

## What's in this release

**Fixes**
- Ask Gemini works again — YouTube started putting its suggested-question chips in the panel token, and questions sent with them were rejected (HTTP 400). Skipper now sends the same token YouTube's own page sends.
- SponsorBlock lookups work — the endpoint path had a typo (`/apiWe/`) in 1.0.2 and 1.1.0, so every lookup silently missed and signed-out users got no skipping at all.
- Shorts are no longer analyzed (each swipe cost page downloads, Gemini calls and a toast).
- Failure toasts show once per session instead of on every uncovered video; "no data for this video" no longer reads as "Something went wrong".
- The ~1 MB watch page is downloaded once per video instead of up to four times.
- Shared-DB segments are validated before use (a bad row can't skip whole videos), and a slow lookup can no longer apply one video's segments to the next.

**New**
- **SponsorBlock first** — community-verified segments in a fraction of a second; Gemini only runs for videos nobody has covered yet (Reanalyze still asks Gemini for a fresh opinion).
- **Toolbar badge** — the number of sponsors found in the current video.
- **Welcome page** on install — pinning, and what signing in to YouTube adds.
- **Share Skipper** — popup header and dashboard; the message includes the user's own time-saved stats.
- **Rating ask** — in the popup after 5 skips; plus an in-page "Skipper has saved you 1h…" milestone toast (10m / 1h / 3h / 10h / 24h) with Rate and Share buttons.

No new permissions and no new data collection — existing users update silently.

---

## Pre-flight checklist
- [ ] **Run [`scripts/shared-tables-hardening.sql`](../scripts/shared-tables-hardening.sql)** in the Supabase SQL editor (safe to re-run). The extension works without it, but the database would keep accepting bad rows from anyone holding the anon key.
- [ ] Confirm `.env` has `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` for the production build.
- [ ] Smoke-test the unpacked `dist/`:
  - **Signed out** (another Chrome profile or a guest window): open `https://www.youtube.com/watch?v=thODYqd9G9U` — the 0:00–0:22 sponsor is skipped and the toolbar badge shows **1**.
  - **Signed in**, on a video SponsorBlock doesn't cover: Gemini finds segments (no `InnerTube HTTP 400` in the console).
  - Swipe through a few **Shorts** — no toasts.
  - Remove and re-add the unpacked extension — the **welcome page** opens.
  - Popup **♥ Share** opens the share sheet; each button opens that app's share page.
- [ ] Package (sourcemaps excluded):
```bash
npm run build
cd dist && zip -r -q ../skipper-1.2.0.zip . -x "*.map" && cd ..
```

---

## Chrome Web Store
1. **[Developer Dashboard](https://chrome.google.com/webstore/devconsole)** → Skipper AI → **Package → Upload new package** → `skipper-1.2.0.zip`.
2. **Store listing** — paste the updated detailed description from [`store-listing.md`](./store-listing.md), and add screenshots of what's new: the toolbar badge on a video, the popup with the share sheet, and the welcome page.
3. **Privacy practices** — nothing changes (same permissions, same data use). Sharing only opens the app the user picks; Skipper itself sends nothing.
4. **Submit for review.**

Share links are tagged `utm_source=<whatsapp|x|telegram|facebook|reddit|email|copy>&utm_medium=share&utm_campaign=in_app`, so you can see which channels bring visitors in the store's analytics (and in Google Analytics, if you link it to the listing).

---

## Microsoft Edge Add-ons (same package, new users)
Edge runs Chrome extensions unchanged, and its store is a separate audience with far less competition.
1. Register (free) at **[Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview)**.
2. **Create new extension** → upload the same `skipper-1.2.0.zip`.
3. Reuse the listing copy, screenshots, privacy-policy URL and permission justifications from the Chrome submission.
4. Review typically takes up to a week.

The in-app Rate / Share links point to the Chrome Web Store, which Edge users can also install and review from.

---

## Launch post

**Where:** r/chrome_extensions first; adapt for r/youtube or r/SideProject a few days later. Check each sub's self-promo rules.

**Title:** *My free YouTube sponsor-skipper now works without signing in — SponsorBlock first, YouTube's own Gemini for brand-new videos*

**Body:**
> Skipper auto-skips sponsor reads on YouTube. 1.2 flips how it finds them: it now checks the SponsorBlock community database first (instant, human-verified), and only asks YouTube's built-in Gemini about videos nobody has covered yet — so it works for everyone, signed in or not, and new uploads still get covered.
>
> Also new: the toolbar icon shows how many sponsors are in the video you're watching, and the dashboard tells you how much time it has saved you (all stored locally).
>
> Free, no API key, open source: https://github.com/jagdishpal02001/skipper · Chrome Web Store: https://chromewebstore.google.com/detail/skipper-ai/ncchpipphiigdfbpbjofbhbahcgckaob?utm_source=reddit&utm_medium=post
