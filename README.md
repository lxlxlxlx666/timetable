# 李翔课表（手机版 PWA）

2026–2027 学年第 1 学期课程表。手机浏览器打开即可使用；可**自动定位今天是第几周**、**手动切换周次**（单周/双周/集中周课程自动过滤），并**高亮今天**。

课表数据自动解析自教务系统导出的 PDF（`data/source.pdf`，打印于 2026-09-07）。

## 快速开始（手机 + 电脑同一 Wi-Fi）

1. 电脑已装 Node.js（本项目脚本均为纯 Node，无第三方依赖）。
2. 在项目目录运行：

   ```bash
   node scripts/serve.js        # 默认端口 8080，也可 node scripts/serve.js 9000
   ```

   启动后会打印访问地址，例如：

   ```
   本机:   http://localhost:8080
   手机:   http://192.168.1.5:8080
   ```

3. 手机浏览器打开 `http://<电脑IP>:8080`。
4. 想当 App 用：
   - **Android（Chrome）**：右上角菜单 →「添加到主屏幕」。
   - **iPhone（Safari）**：分享按钮 →「添加到主屏幕」。

## 部署到公网（完整离线 PWA）

`app/` 目录完全自包含，传到任意静态托管即可（GitHub Pages / Netlify / Vercel / Cloudflare Pages 均可）。HTTPS 下会自动启用 Service Worker 离线缓存。

以 GitHub Pages 为例：把 `app/` 内所有文件放到仓库根目录的 `docs/` 或独立仓库根，开启 Pages 即可。

## 目录结构

```
timetable-pwa/
├─ app/                     # 手机端网页（可整体部署）
│  ├─ index.html            # 页面骨架
│  ├─ style.css             # 样式（手机优先）
│  ├─ app.js                # 渲染 / 周次切换 / 今日高亮 / 教师校对
│  ├─ timetable-core.js     # 周次计算纯逻辑（浏览器与 Node 共用）
│  ├─ data.json             # 课程数据（含 meta.periods 作息时间）
│  ├─ sw.js                 # Service Worker（离线缓存）
│  ├─ manifest.webmanifest  # PWA 清单
│  └─ icon.svg / icon-*.png # 图标
├─ data/                    # 源数据与解析产物
│  ├─ source.pdf            # 原始课表 PDF（教务系统导出）
│  ├─ courses.json          # 解析出的结构化数据（含 meta.periods）
│  └─ report.txt            # 人读校对报告
└─ scripts/
   ├─ parse.js              # PDF → courses.json
   ├─ add-periods.js        # 注入 13 节作息时间到 meta.periods（幂等）
   ├─ fix-teachers.js       # 修正 PDF 字形损坏的教师名（人工核对表）
   ├─ gen-icon.js           # 重新生成图标 PNG
   ├─ serve.js              # 本地静态服务器
   ├─ smoke.js              # 浏览器 DOM 冒烟断言
   └─ test-core.js          # 周次逻辑自测
```

## 更换 / 更新课表

1. 把新 PDF 放到 `data/`，运行：

   ```bash
   node scripts/parse.js data/<新文件>.pdf data/courses.json
   ```

2. 检查 `data/report.txt` 校对结果。
3. 套用人工修正（作息时间与教师名）：

   ```bash
   node scripts/add-periods.js     # 注入 13 节作息时间（数据本身不含时间）
   node scripts/fix-teachers.js    # 修正 PDF 字形损坏的教师名
   ```

4. 复制给网页使用：

   ```bash
   cp data/courses.json app/data.json
   ```

5. 开学第 1 周周一日期默认取 `courses.json` 里的 `meta.week1Date`（当前为 `2026-09-07`），也可以在 App「⚙ 设置」里随时改，设置只存本机。

> 提示：`app/data.json` 采用「网络优先」缓存策略，更新后刷新页面即可看到新课表。

## 作息时间

13 节课的起止时间（2026–2027-1）存放在 `meta.periods`（见 `data/courses.json` / `app/data.json`），在三个位置显示：

- 课表左侧**时间轴**：每节显示节次号与开始时刻；
- **课程卡**：右上角节次旁显示该课起止时间，如「第1-2节 · 8:00-9:40」；
- **课程详情**：第一行信息栏含起止时间。

| 节次 | 时间 | 节次 | 时间 | 节次 | 时间 |
|---|---|---|---|---|---|
| 1 | 8:00–8:45 | 6 | 13:30–14:15 | 11 | 19:00–19:45 |
| 2 | 8:55–9:40 | 7 | 14:25–15:10 | 12 | 19:50–20:35 |
| 3 | 9:55–10:40 | 8 | 15:25–16:10 | 13 | 20:40–21:25 |
| 4 | 10:50–11:35 | 9 | 16:20–17:05 | | |
| 5 | 11:45–12:30 | 10 | 17:15–18:00 | | |

（课间与午/晚餐间隙：9:40–9:55 大课间、12:30–13:30 午餐、18:00–19:00 晚餐。）

作息如有变化，改 `scripts/add-periods.js` 里的 `PERIODS` 后重跑一次即可（幂等）。

## 周次机制说明

- 以「开学第 1 周周一」为基准，打开时自动显示**今天是第几周**。
- 每门课按教务数据中的周次规则过滤显示：
  - `1-16周`：每周都有；
  - `1-15周(单)` / `2-16周(双)`：只在单周 / 双周出现；
  - `16周` / `18周`（周六、周日集中实践课）：只在对应周出现（页面底部会给出提示）。
- 顶栏「上一周 / 下一周」随时手动切换；点状态栏或「回到本周」立即跳回当前周。
- 显示当前周时，今天的日期列会高亮并标注「今天」。

## 已知说明

- 原 PDF 中**个别汉字字形损坏**（主要是教师姓名中的「师」字与部分姓名用字被编码成乱码字符）。已按人工核对结果修正为：凌霄、王重阳、韩高勇、王敏、乔喜英、贾文超、张鹏飞（见 `scripts/fix-teachers.js`）。如日后更换 PDF 重新解析，运行一次 `node scripts/fix-teachers.js` 即可套用同一份修正。
- 网页必须通过 **HTTP 服务器**访问（直接双击 `index.html` 无法加载数据）。

## 自测

```bash
node scripts/test-core.js   # 周次计算与单双周过滤（17 项断言，含真实数据快照）
```
