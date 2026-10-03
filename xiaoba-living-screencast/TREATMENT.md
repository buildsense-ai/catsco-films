# 《小八上班了》 · CatsCo · Living Screencast

Style: Lemo-Opuscar **Living Screencast (活体实机录屏)**. The real CatsCo WebApp is redrawn in HTML/CSS
from the live UI (`webapp/`, dark theme, measured from the running app). A big-pixel mascot, **小八 (Xiaoba)**, lives
inside the high-resolution interface and acts out what the AI employee is doing. The cursor is the user; the
mascot is the software. There is no hand on screen.

All task content is **mock data**: 陈宇's project `billing-web`, the error in `total.ts`, the devices office-mbp and
home-ws, the 214 tests, the old conversation and the `TZ` hint. The UI chrome (sidebar sections, empty-state heading,
composer hint, model pill, bubble shapes and colours) comes from the real app.

## 1. Logline and arc

**小八 is born out of the CatsCo logo and takes one sentence from the user to the finished result, across every
authorized computer, without the user opening any of them.**

Setup: the logo becomes 小八 and the user states a goal → Turn: it works across two authorized devices, gets stuck
on a failing test, splits in two to search old conversations while the main line keeps working → Resolution: the
patch and report land back in the chat; 小八 hops the slogan and folds back into the logo.

## 2. References (grammar only)

- Screen Studio-style recordings: auto-zoom to the action, smoothed cursor, click push-ins, a window floating on wallpaper.
- Apple "Guided Tour": the real interface, calm narration, one feature per sentence.
- Duolingo / Headspace mascot motion: squash and stretch, anticipation, a character acting inside the UI.
- Taken from none of them: characters, UI, music or footage.

## 3. The native move

**The logo is the mascot.** The CatsCo "M" has two raised outer corners, and quantised to square pixels they are a
cat's ears. In the cold open the M snaps to the pixel grid, the middle V drops out, and two eyes open. At the end,
小八's last jump folds it back into the M. The film opens and closes on the same shape.

## 4. Chapters and camera (one continuous take inside the screen, zoom ≥ 1)

| # | chapter | picture | camera |
|---|---|---|---|
| 0 | cold open | the pixel M sits in the empty-state heading → becomes 小八 → lands on the heading "需要为您做什么，陈宇？" | starts at 1.5× on the M, eases out to the window |
| 01 | 交代目标 (state the goal) | cursor clicks the composer and types; 小八 walks with the caret; Enter; the message flies up as the user bubble and 小八 rides it | push-in on the composer, follows the bubble up |
| 02 | 指定设备 (pick the devices) | the reply lists the authorized online devices as chips; 小八 jumps onto "公司电脑"; the chat splits and a 设备活动 (device activity) pane opens; ▶▶ 4× time-lapse over the log; "!" on the error, pixel pencil on the diff, ✓ build | whip to the pane; push on the error line |
| 03 | 并行检索 (search in parallel) | jumps to "家用工作站": tests tick; one fails (sweat); **cell division**: a clone runs to 历史任务 and hops the rows to the old conversation, bringing back `TZ=Asia/Shanghai`; the main line keeps ticking; the two merge; 214 pass | wide on the split, follows the clone and back |
| 04 | 带回结果 (bring back the result) | the pane closes into the chat; the reply arrives with patch + report; the cursor pets 小八 → heart | settles on the reply |
| end | slogan | the empty-state heading becomes the slogan; karaoke hops word by word; the last jump folds 小八 into the logo; wordmark + app.catsco.cn | pull back to 1.0 |

## 5. Sound

- **Two resolutions.** A hi-fi band (FM electric piano, bass, a synthesized kit and glockenspiel) is the world; a chiptune square wave is 小八's voice.
- The band enters when 小八 lands on the heading. Each chapter change gets a tom fill and a crash. Chapter 03 drops the drums (tension) until the merge. The end-card words are chiptune notes, and the last jump opens a big maj9 chord.
- Foley: keyboard (a thock plus a click, with deterministic jitter), trackpad clicks, pane swishes, popup pops, CI ticks. 小八's steps, jumps and landings are 8-bit.
- VO: MiniMax speech-2.8-hd, voice 温暖闺蜜 (Warm_Bestie), calm, one feature per line. The music ducks under it and the key clicks are kept off word onsets.

## 6. Deliverables

`catsco-xiaoba.mp4` (1920×1080, 24 fps, −14 LUFS), `catsco-xiaoba.srt`, `poster.jpg`, the source, and `build.sh`.
