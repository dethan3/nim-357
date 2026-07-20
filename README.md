# 三五七 · Nim

一个适配 **手机、平板和桌面浏览器** 的三五七取石子网页游戏。无需安装依赖，打开网页即可双人对战，也可以作为 PWA 添加到主屏幕并离线游玩。

## 在线游玩

GitHub Pages 发布后访问：

`https://dethan3.github.io/nim-357/`

## 规则

- 开局共有 3、5、7 三排石子。
- 每回合只能从同一排取走任意数量的石子。
- 每次至少取走 1 颗。
- **取到全场最后一颗石子的人输。**

## 交互与适配

- 手机、平板、桌面浏览器响应式布局。
- 支持触屏点按和横向拖选多颗石子。
- 支持鼠标点击、按住拖选和键盘操作。
- 针对窄屏手机、横屏设备和桌面大屏分别优化尺寸。
- 支持撤回上一步、多局比分和轮流先手。
- 支持添加到主屏幕及离线游玩。
- 尊重系统的“减少动态效果”设置。

## 本地运行

这是一个无依赖静态网页。普通试玩可以直接打开 `index.html`。

测试 PWA 和离线缓存时，需要通过 HTTP 服务运行：

```bash
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`。

## GitHub Pages

仓库包含 GitHub Pages 工作流。推送到 `main` 后，在仓库中打开：

`Settings → Pages → Source → GitHub Actions`

之后每次推送到 `main` 都会自动部署。

## 项目结构

```text
.
├── .github/workflows/pages.yml
├── icons/
│   ├── icon.svg
│   ├── icon-180.png
│   └── icon-192.png
├── app.js
├── index.html
├── manifest.webmanifest
├── styles.css
└── sw.js
```

## License

MIT
