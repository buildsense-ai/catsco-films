# catsco-films

CatsCo 的宣传视频，按片子（case）分目录。每个 case 自带源码、素材、脚本和成片。

## Cases

| Case | 片名 | 时长 | 形式 | 成片 |
|---|---|---|---|---|
| `catsco-promo-28s/` | CatsCo Promo | 28 s | 代码渲染一镜到底；一条消息穿过各设备，走出的路线就是 CatsCo 的 M | `out/catsco-promo.mp4` |
| `xiaoba-living-screencast/` | 小八上班了 | ~50 s | Living Screencast：真实 WebApp 重绘成 HTML/CSS，像素小八在界面里演；含中文配音 | `catsco-xiaoba.mp4` |
| `xiaoba-growth-film/` | 小八上班记 | 2:23 | git-story-film：小八沿两条轨道（两个仓库的真实提交历史）旅行 | `out/catsco-story-2160p60.mp4` |

## 约定

- 每个 case 的结构：`源码与素材` + `out/`（成片与可直接分享的交付物）+ `README.md`（制作说明与复现命令）。
- 可再生的中间文件（音频 stems、逐帧 PNG、构建缓存）不入库；成片入库。
- 字体均为 SIL OFL，授权文件随素材放；音乐与音效由代码合成，无授权素材。
- 片中哈希、日期、提交数须来自仓库真实数据；示意内容须在画面上标注「示意」。

## 数据源

`xiaoba-growth-film` 使用 2026-09-29 从 GitHub 全新克隆的
[buildsense-ai/XiaoBa-CLI](https://github.com/buildsense-ai/XiaoBa-CLI)（Runtime）与
[buildsense-ai/cats-company](https://github.com/buildsense-ai/cats-company)（Platform）的完整历史。
