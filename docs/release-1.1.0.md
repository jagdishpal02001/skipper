# Releasing Skipper v1.1.0

## What's in this release
- 💬 AI audience ratings (badge next to like/dislike; popup card)
- 📊 Private, on-device usage dashboard (time saved, watch/browse/Shorts, top channels)
- Refactored shared InnerTube helpers; like-weighted, stance-aware sentiment prompt

---

## Pre-flight checklist
- [ ] `npm run build` is clean (typecheck + lint pass)
- [ ] **Run [`scripts/sentiment-table.sql`](../scripts/sentiment-table.sql)** in the Supabase SQL editor (creates the `sentiment` table + RLS). Without it, rating-sharing silently no-ops.
- [ ] Confirm `.env` has `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set for the production build.
- [ ] Smoke-test the loaded `dist/`: badge appears on a fresh video; dashboard opens from the popup; skip a sponsor and confirm "time saved" increments.
- [ ] Package: `skipper-1.1.0.zip` (already generated at repo root — `manifest.json` at zip root, sourcemaps excluded).

To regenerate the zip:
```bash
npm run build
cd dist && zip -r -q ../skipper-1.1.0.zip . -x "*.map" && cd ..
```

---

## Chrome Web Store — step by step

1. Go to the **[Developer Dashboard](https://chrome.google.com/webstore/devconsole)** → select **Skipper AI**.
2. **Package → Upload new package** → upload `skipper-1.1.0.zip`. It must validate (version `1.1.0` > published `1.0.2`).
3. **Store listing** tab — update from [`docs/store-listing.md`](./store-listing.md):
   - Short **Description** (broadened to all three features).
   - **Detailed description** (the full block).
   - Add 1–2 **new screenshots**: the rating badge on a real video + the dashboard page. (Screenshots are the single biggest install-rate lever — do not skip.)
4. **Privacy practices** tab — this is where the last rejection happened, so be thorough:
   - **Single purpose**: paste the single-purpose statement.
   - **Permission justifications**: paste each (`storage` + the three host permissions + "no remote code").
   - **Data usage**: check the disclosures exactly as noted in the doc, and tick all three certification boxes.
   - **Privacy policy URL**: publish the policy (fill `<DATE>` + contact email first) and paste the live URL. Required now that data use is declared.
5. **Save draft** → **Submit for review**.
6. Review typically takes a few hours to a few days. If rejected, the email cites a specific policy — fix and resubmit; don't blind-resubmit.

### If a reviewer questions the dashboard
The usage dashboard is the most likely flag ("track time" vs "skip sponsors"). Response: it's scoped entirely to the YouTube watch experience and stored **only on-device** (no transmission), so it falls under the same single purpose. The listing copy already frames it that way.

### Rollback
If something's wrong post-publish, re-upload the previous `skipper-1.0.2.zip` as a new (higher) version, or use **un-publish** in the dashboard.

---

## Reddit launch post

**Where:** r/chrome_extensions (most receptive), r/youtube, r/software, r/SideProject. Post to ONE first, see how it lands, then adapt. Read each sub's self-promo rules — some require a flair or limit frequency. Reply to every comment for the first few hours; engagement drives the algorithm.

**Title options:**
- *I added AI "audience ratings" to my YouTube sponsor-skipper — it tells you what viewers actually think before you commit to a video*
- *My free YouTube extension now shows an AI rating /10 from the comments, plus a private watch-time dashboard [open source]*

**Body:**

> I've been building **Skipper**, a free, open-source extension that auto-skips sponsor segments on YouTube (SponsorBlock DB + YouTube's built-in Gemini for videos the community hasn't covered). This week's update adds two things I actually wanted for myself:
>
> **1. AI audience ratings.** A little `✦ x/10` badge shows up next to the like/dislike buttons. It reads the top comments (weighted by likes, so popular takes count more) and asks Gemini how the audience actually received the video — then shows a positive/negative breakdown and a one-line summary. The tricky part was making it rate *stance toward the video* rather than comment *tone*: on a video criticizing something, people leave angry comments *in agreement* — those should count as positive, and now they do.
>
> **2. A private watch-time dashboard.** Total time Skipper has saved you, hours on YouTube, your top channels, watching-vs-just-browsing split, and time lost to Shorts. All of it is computed and stored **only on your device** — nothing is uploaded.
>
> Still free, still no API key (it drives YouTube's own Gemini), still MIT-licensed. Shared data (sponsor timestamps + ratings) is keyed by a one-way hash of the video ID, so what you watch isn't tied to you.
>
> Chrome Web Store: <link> · Code: https://github.com/jagdishpal02001/skipper
>
> Happy to answer anything about how the InnerTube/Gemini plumbing works — it was a fun rabbit hole. Feedback welcome, especially on the rating accuracy.

**Tips:**
- Lead with the *problem/story*, not "check out my extension." The stance-vs-tone anecdote is your hook — it shows craft.
- An animated GIF of the badge appearing + the dashboard massively outperforms text. Record a 5–10s clip.
- Don't drop the same copy-paste in five subs the same day — reads as spam and gets you shadow-flagged.
- Disclose it's yours (most subs require it) and that it's free/open-source up front.
