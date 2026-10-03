# CatsCo Promo（28 s）

一条消息从手机发出，变成绿色 token，依次走过公司电脑（修构建）→ CatsCo Cloud → 家用工作站（全量测试，Branch Agent 翻出旧决定）→ 回到手机。每一跳画出 CatsCo「M」的一笔；镜头拉开，路线加粗成真正的 Logo。

**设备、文件、测试数和聊天文字均为 mock data。**

方法：
- [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) — 画面与音频共用一条时间线，逐帧纯函数，`seek(t)` 确定性渲染。
- [feitangyuan/onetake](https://github.com/feitangyuan/onetake) — 一镜到底，拍长不等，命中前留白。

## Files

- `comp/timeline.js` — 单一时间线（120 BPM，段落与 cue）。
- `comp/comp.html` — 画面合成（`window.__seek / __ready`）。所有文案、行、测试文件都在此。
- `tools/score.py` — 原创音乐（D 大调）与音效，−16 LUFS。
- `tools/render.py` — 静帧与视频（Playwright Chromium，自适应快门模糊）。
- `out/catsco-promo.mp4` — 成片（1080p30）。

## Rebuild

```sh
python3 tools/score.py                                  # → out/mix.wav (+ stems)
python3 tools/render.py video --audio out/mix.wav --out out/catsco-promo.mp4        # 1080p30, ~7 min on M4
python3 tools/render.py video --final --audio out/mix.wav --out out/catsco-promo-60.mp4
```

Live preview: `open comp/comp.html?play`（播放 `../out/mix.wav`；`?t=16.6&hud` 定帧）。

需要 python3 + `playwright`（Chromium）、`numpy`、`scipy`、`Pillow`、`ffmpeg`。
