# FocoMan Studios Social Framework

**Version:** 0.2 · **Updated:** 2026-11-03 · **Scope:** reusable production guidance and small brand assets only.

The user supplies each video's content. This module defines consistent publishing outputs; it is independent of the application runtime and adds no package, renderer, service or dependency. Framework setup does not create or publish an episode.

## Ownership and storage

| In Git | On the device, outside this checkout |
| --- | --- |
| This framework, [brand references](brand/README.md), three SVG logos, [reusable skill](skills/focoman-video/SKILL.md) | Episode stories/scripts, screenshots, recordings, audio, subtitles, thumbnails, videos, render code/dependencies, caches and exports |

Use `C:\Users\DELL\Downloads\FocoMan-Social\<episode>\` for new episode work. The existing `C:\Users\DELL\Downloads\FocoMan-Founder-Video\` archive also remains device-only. On another device, choose an equivalent location outside the checkout. Preserve source materials and approved versions there; even small episode text/scripts do not belong in Git.

The scoped `.gitignore` allows only listed reusable files. Additional tracked framework assets require a deliberate allowlist update. Runtime tools belong outside Git; the active legacy root `.tools/` helper is ignored and is not part of this module. Application assets remain owned by the app; the small exports here are checked copies, not a new brand authority.

## Confirmed output package

| Deliverable | Requirement |
| --- | --- |
| Full YouTube video | **Landscape 16:9, 2–3 minutes**; native 1920×1080 MP4 is the working export default |
| Short / trailer / Reel | **Portrait 9:16, 32–45 seconds**; native 1080×1920 MP4 is the working export default |
| Main thumbnail | **Two designs**, each with correct logo, prominent accurate topic text and a clear focal image |
| Short cover | One matching portrait preview image: the picture shown before someone opens the Short; also select a suitable video frame |
| Subtitles | Reviewed Tamil and English subtitle files; keep a clean master for alternate caption versions |
| Publishing package | Title options, description, relevant topic keywords/search phrases, useful chapters, credits and relevant hashtags |

The final corrected Short duration is 32–45 seconds, replacing earlier 25–40/30-second suggestions. Edit the script's scope and pacing rather than padding or rushing speech. Respect later per-video overrides and requests for only one format. English dubbing is a per-episode option, not an automatic paid-service request.

Thumbnail text should identify the real subject, such as **OMS**, **FocoMan**, or **Our Story**. Choose wording for the actual content, with readable hierarchy and the current logo; avoid invented metrics/results. Recompose the portrait edit instead of shrinking a landscape frame into a narrow strip.

## Reusable creative treatment

Use the current app theme and [verified brand kit](brand/README.md). Keep typography, captions, section cards, lower thirds, transitions and intro/outro treatments consistent. The first experimental video's paper palette is not the app theme.

- **Branding:** subtle transparent corner logo and FocoMan Studios text, clear of subjects, important UI, captions and platform controls.
- **Starting design values:** logo 20–30% opacity and text 15–25%; positions, sizes and exact opacity remain adjustable proposals, not approved fixed values.
- **Opening:** a content-specific hook, then a brief series/episode identity. Avoid a long logo animation before the story.
- **Sections:** meaningful beats with authentic supporting visuals; add dates, titles or speaker/tool labels when useful.
- **Ending:** resolve the story, offer one relevant next step, and let final words/music finish naturally. Reserve end-screen space when useful; artwork itself is not a clickable platform element.
- **Sound:** clear narration above quiet music, purposeful effects and gentle fades. Preserve separate voice, music and caption sources on the device.

Full-video shape: **hook → context → main sections → payoff → conclusion/outro**. Tutorials can use **problem → steps → demonstrated result → next step**. A Short needs a direct opening, one complete idea and a payoff, understandable without watching the full video.

## Screenshots and product truth

- Use actual running-app screenshots/recordings or verified existing app captures. Capture when the episode needs them and keep the files device-only.
- Crop, scale, annotate or faithfully reproduce an already verified screen when necessary, preserving layout, labels, data and behaviour. Identify a reproduction as such; do not present it as a live capture.
- Never invent dashboards, features, layouts, sample customers or orders to replace missing material. Report unavailable captures and use a truthful non-screen explanation until real material is available.
- Follow `Agents.md`: no automated browser windows or browser UAT. Use user-provided captures or an explicitly permitted method; do not bypass browser access restrictions.
- Record asset origin/version and relevant permission locally. Remove private customer details and credentials from published captures without changing the represented feature.

## Voice and languages

Write casual spoken Tamil with natural English technical terms and purposeful pauses. Prefer the user's own recording when supplied and desired; noise/level editing should retain personality. A transcript is not a voice sample. Adapt an English version naturally rather than translating word for word.

Use a short audition for a new synthetic voice when creative review is needed. Preserve already approved decisions instead of asking again. Check FocoMan and technical pronunciation, code-switching, caption readability and Tamil shaping. Report provider failures instead of silently changing voice, cost or data handling.

## Publishing and SEO

Derive a primary search phrase and a few relevant supporting phrases from the topic/audience. Include the subject naturally in the title, thumbnail headline and opening description. Supply a clear summary, useful links, credits and chapter timestamps from the finished timeline; provide Tamil/English text where useful.

Keywords describe the real content; they do not guarantee rankings. Avoid stuffing or unrelated trending tags. Custom cover uploads, end screens, chapters and audio tracks depend on current platform/account capabilities; check them when publishing. File creation alone does not authorize account changes or publication.

## Working series options

| Proposed series | Purpose |
| --- | --- |
| FocoMan Stories | Founder journey and product decisions |
| Building FocoMan | Real development work and lessons |
| Inside FocoMan | Product walkthroughs and studio workflows |
| FocoMan Studio Notes | Broader freelance, AI and development learning |
| FocoMan Updates | Verified product changes when available |

Names and episode structures remain editable; creating every series is not required. Channel banner, profile crop, trailer and playlist identity can be separate one-time work.

## Repeatable workflow

1. Extract a brief: topic, audience, purpose, formats, voice/language, facts/assets, exclusions and ending. Infer routine preferences already established.
2. Prepare the script and sections within the confirmed duration ranges. Keep all episode text/storyboards outside Git.
3. For a new treatment, use representative voice/style samples for requested review. Reuse accepted templates and existing authorization later.
4. Assemble verified assets and narration, edit the full video and independently recompose the Short.
5. Produce thumbnails, portrait cover, subtitle files and publishing/SEO copy in the device episode folder.
6. Verify brand match, duration/aspect ratio, complete decoding, audio sync/clarity, captions and factual consistency. Report only performed checks; user app/browser validation remains separate.
7. Deliver supported attachments or an authorized accessible link. A Windows path is not a phone download. State expiry/host-online requirements for temporary sharing and expose only approved deliverables.

No new episode or rendering engine is created by this migration. The next production starts from the user's next content brief.

## Platform references

Check official guidance when production/publication depends on it: [Shorts](https://support.google.com/youtube/answer/15424877?hl=en), [thumbnails](https://support.google.com/youtube/answer/72431?hl=en), [end screens](https://support.google.com/youtube/answer/6388789?hl=en), [automatic dubbing](https://support.google.com/youtube/answer/15569972?hl=en), [audio tracks](https://support.google.com/youtube/answer/13338784?hl=en). The duration ranges above are user choices, not platform maximums.
