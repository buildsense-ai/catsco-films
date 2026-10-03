# 小八上班了（Living Screencast）

把真实的 CatsCo WebApp（`webapp/`，暗色主题）重绘成 HTML/CSS；像素小八住在高分屏界面里，替软件演戏。光标是用户，小八是软件。**所有任务内容是 mock data**（陈宇的 billing-web、total.ts 的错误、office-mbp / home-ws、214 个测试、TZ 提示）。

设定：Logo 即吉祥物。CatsCo 的 M 两个上翘外角量化成像素后就是猫耳；片头 M 打散变成小八，片尾跳回去折成 Logo。

章节：开场（Logo→小八）→ 交代目标（光标打字）→ 指定设备（公司电脑：日志→报错→diff→构建通过）→ 并行检索（家用工作站：测试卡住，分身翻历史带回 `TZ=Asia/Shanghai`，合并后 214 全过）→ 带回结果（patch + 报告回对话）→ 口号折回 Logo。

## Files

- `film.js` — 时间线、镜头、像素小八与所有文案。
- `index.html` + `style.css` — 重绘的 WebApp 界面。
- `assets/` — Logo、壁纸。
- `tools/tts.py` — MiniMax 配音（`voices/` 按行缓存）。
- `tools/render.py`、`tools/sound.py`、`tools/srt.py` — 帧渲染、混音、字幕。
- `events.json` — 事件表（EV、字幕、cue）。
- `catsco-xiaoba.mp4` · `catsco-xiaoba.srt` · `poster.jpg` — 成片、字幕、封面。
- `TREATMENT.md` — 完整制作说明。

## Rebuild

```sh
sh build.sh   # 需要 python3（playwright + chromium、numpy、scipy、pillow）、ffmpeg；改文案才需要 MINIMAX_API_KEY
```

Live preview: `open index.html`。
