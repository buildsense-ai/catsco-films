# 小八上班记（git-story-film · 2:23）

像素小八沿两条轨道旅行：上轨是 [XiaoBa-CLI](https://github.com/buildsense-ai/XiaoBa-CLI)（Runtime），下轨是 [cats-company](https://github.com/buildsense-ai/cats-company)（Platform）。每次提交是当天的一块砖（真实日计数），32 个 Release 是旗子，两仓同日关键提交是缝线，两次企业微信回滚是摔跤。一镜到底只向右，结尾拉远到全部 238 天、2,609 次提交，小八折回 CatsCo 的 M。

使用 [EverMind-AI/Raven](https://github.com/EverMind-AI/Raven) 的 `skills/git-story-film` 七步流程制作（大纲 → 角色 → 分镜 → 制作 → Studio → 渲染）。

## Files

- `catsco-story.html` — 影片本体，打开即 Studio（拖动进度条、逐帧、配乐同步）。
- `xb-pixel.js` `xb-world.js` `xb-film.js` `xb-score.js` `xb-data.js` — 角色、世界、路线、配乐、真实提交数据（由 `git_timeline.py` 与 `git tag` 生成）。
- `cast-sheet.html` — 角色设定表（表情 / 动作 / 材质 / 尺寸检查）。
- `shots.json` + `storyboard/` — 分镜与每镜头依据；`storyboard-send.html` 可单独转发。
- `OUTLINE.md` — 每节拍、提交依据与计数口径。
- `fonts/` — SIL OFL 字体与授权；`engine`（core/cels/materials/studio，MIT，见 `LICENSE.hand-drawn-canvas-animation`）。
- `out/catsco-story-2160p60.mp4` — 成片（4K60，带封面帧）。

## Rebuild

```sh
npm i
node frames.mjs catsco-story.html load            # 检查：加载、帧数
node render-hq.mjs catsco-story.html --width 3840 --fps 60   # → out/*.mp4（约 10 min）
```

需要 Node 22+、Google Chrome、ffmpeg、Python 3.8+。
