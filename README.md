# 黑枪 · 自由美利坚

基于 Three.js WebGPU 的浏览器战术射击游戏，前端使用 JavaScript，联机后台使用 Rust（Axum / Tokio）。支持本机离线 AI 对战、局域网联机和公网联机，每队最多 5 人、每个房间最多 10 人，空位由 AI 补齐。原 UE 工程保留在历史提交 `88bcb3e`。

## 环境要求

- Node.js 22 或更新版本与 npm。
- 联机后台需要 Rust stable / Cargo；仅运行前端离线游戏无需 Rust。
- 支持 WebGPU 的桌面 Chrome / Edge，开启硬件加速，使用键盘和鼠标。
- 局域网证书生成命令需要 OpenSSL，可通过 `OPENSSL_PATH` 指定可执行文件。

WebGPU 要求安全上下文：本机可用 `http://localhost`，其他设备必须使用证书受信任的 HTTPS。普通 `http://局域网IP` 或 `http://公网IPv4` 无法使用本项目的 WebGPU 画面。

## 本机启动

在项目根目录运行：

```bash
npm ci
npm run dev
```

默认启动前端 `5173` 端口和 Rust 后台 `3000` 端口。首次启动需要下载并编译 Rust 依赖。浏览器打开 `http://localhost:5173`；已配置前端证书时改用 `https://localhost:5173`。

选择作战模式、队伍规模和 AI 难度，点击“开始行动”进入离线比赛。准备阶段可选装备，点击“确认就绪”或按 Enter 开始战斗。

前后端也可分别启动：

```bash
npm run dev:backend
npm run dev:frontend
```

以上两条命令分别在两个终端运行。只玩离线 AI 时只需启动前端。请通过服务器访问页面，不要直接双击 `index.html`。

## 局域网联机

服务电脑与玩家电脑需要能够互相访问。服务电脑先安装依赖，再生成 HTTPS 证书：

```bash
npm run setup:https
```

该命令为本机当前 IPv4 地址与 localhost 生成证书，将路径写入 `frontend/.env`。证书保存在 `frontend/.certs/`，不会提交到 Git。需要加入其他主机名或 IP 时可运行：

```bash
npm run setup:https -- 主机名或IP
```

把 `frontend/.certs/blackarms-lan-ca.crt` 复制到每台玩家电脑（包括需要访问页面的服务电脑），在各自的 PowerShell 执行：

```powershell
certutil -user -addstore Root "C:\实际保存位置\blackarms-lan-ca.crt"
```

安装后重启浏览器。只分享这个 `.crt` 文件，证书目录中的私钥留在服务电脑。IP 变化后重新运行生成命令；原 CA 会保留，已安装的信任继续有效。

随后启动或重启服务：

```bash
npm run dev
```

使用终端打印的局域网 HTTPS 地址，例如 `https://192.168.1.10:5173`。允许前端端口通过服务电脑的防火墙，所有玩家打开同一个页面地址。

1. 房主选择模式、队伍规模和难度，点击“联机房间”。
2. 选择“局域网联机”，“房间服务器”留空，输入呼号并创建房间。
3. 房主分享六位房间码，其他玩家输入房间码加入。
4. 玩家选择 ALPHA / BRAVO，房主点击“开始比赛”，空位自动补 AI。

比赛开始后不接受新玩家加入。断线角色由 AI 接管，房主断线会转交房主身份；暂停菜单不会暂停联机比赛。关闭后台会断开所有房间。

## “房间服务器”怎么填

房间服务器是负责创建房间、同步玩家和运行比赛的后台地址，六位房间码用于选择其中的某个房间。

| 场景 | 房间服务器填写方式 |
| --- | --- |
| 使用本项目 `npm run dev` 局域网联机 | 留空 |
| 公网静态服务器已将 `/lan` 代理到 Rust 后台 | 留空 |
| 前端与后台使用不同地址或端口 | 填后台的 HTTPS 地址，例如 `https://203.0.113.10:8443` |

表中的公网 IP 为示例，请换成实际地址。留空时使用当前网站的 `/lan`；开发和预览服务已配置代理，默认转发到 `http://127.0.0.1:3000`。

地址支持 `https://` 和 `wss://`，只填写根地址时自动补 `/lan`。HTTPS 页面必须连接 HTTPS/WSS 后台，不能直接填写默认的 `http://服务器:3000`。

“局域网联机 / 公网联机”分别保存服务器地址并显示对应提示，切换选项不会自动配置公网端口映射或发布服务器。所有玩家需要连接同一个后台进程，房间码才可互通。

## 公网 IPv4 部署

公网可以直接使用 IPv4，无需强制购买域名，但访问页面仍需 HTTPS。证书必须覆盖实际访问的公网 IP，且被玩家浏览器信任。要让玩家无需安装 CA，需使用受信任机构签发的 IP 地址证书，并按有效期续期；局域网命令生成的证书需要每台玩家电脑手动安装 CA。

推荐结构：

```text
玩家浏览器 → HTTPS 公网IPv4:443 → Nginx
                                  ├─ /     → 前端静态文件
                                  └─ /lan  → Rust 后台 127.0.0.1:3000
```

部署步骤：

1. 准备可达的公网 IPv4、HTTPS 证书和端口；路由器部署需配置端口映射，服务器需放通实际使用的 HTTPS 端口。
2. 在根目录运行 `npm run build`，将整个 `frontend/dist/` 发布到静态服务器，包括 `art/` 和 `config.js`。
3. 运行 `cargo build --release --locked --manifest-path backend/Cargo.toml`，得到 `backend/target/release/blackarms-backend`（Windows 为 `.exe`）。
4. 配置后台环境文件，示例如下。将示例 IP 替换为实际公网 IP；非默认 HTTPS 端口也要写入 Origin。

```dotenv
APP_MODE=public
HOST=127.0.0.1
PORT=3000
ALLOWED_ORIGINS=https://203.0.113.10
```

后台开发时读取 `backend/.env`；发布可通过环境变量 `BACKEND_ENV_FILE` 指定配置文件绝对路径。环境变量优先于文件配置。公网模式必须明确配置 `ALLOWED_ORIGINS`，填写浏览器页面的协议、主机和端口，不含路径。多个 Origin 用逗号分隔。

5. 启动后台可执行文件，并配置进程管理与自动重启。编译后的后台无需 Node.js 或 Rust 工具链。
6. 参考 [Nginx 配置模板](frontend/deploy/nginx.conf)，将域名、证书路径和静态目录替换为实际值；IPv4 部署将 `server_name` 改为实际 IP。检查配置后加载服务。

Nginx 在公网提供 HTTPS/WSS，Rust 使用内部 HTTP。`/lan` 代理需要转发 WebSocket 的 Upgrade / Connection，以及原始 Origin / Host。玩家打开 `https://公网IPv4`，选择“公网联机”，“房间服务器”留空即可。

如果后台单独部署，在发布后的 `config.js` 设置默认地址：

```js
window.BLACKARMS_CONFIG = {
  networkMode: 'public',
  backendUrl: 'https://203.0.113.10:8443',
};
```

独立后台地址也需 HTTPS 反向代理，并在 `ALLOWED_ORIGINS` 中允许前端页面的 Origin。玩家可以在房间界面覆盖默认后台地址。

`npm start` 只启动 Rust 后台，不提供游戏页面。`npm run preview` 用于本机验证构建，默认端口 `4173`，生产环境使用静态服务器。

## 配置

| 配置 | 用途 |
| --- | --- |
| `frontend/.env` | 前端开发 / 预览配置，模板见 [frontend/.env.example](frontend/.env.example) |
| `FRONTEND_TLS_KEY` / `FRONTEND_TLS_CERT` | 前端 HTTPS 私钥和证书，需同时设置；相对路径以 `frontend/` 为基准 |
| `FRONTEND_PORT` | 前端端口；联合开发默认 `5173`，预览默认 `4173` |
| `BACKEND_URL` | 开发 / 预览 `/lan` 代理目标，默认 `http://127.0.0.1:3000` |
| `VITE_BACKEND_URL` / `VITE_NETWORK_MODE` | 构建时的默认后台地址与联机模式 |
| `frontend/public/config.js` | 部署时默认配置；构建后可直接修改 `frontend/dist/config.js`，无需重新构建 |
| `backend/.env` | 后台配置，模板见 [backend/.env.example](backend/.env.example) |
| `APP_MODE` | `local` 默认监听回环地址；`lan` / `public` 默认监听所有网络接口 |
| `HOST` / `PORT` | 覆盖后台监听地址与端口，默认端口 `3000` |
| `ALLOWED_ORIGINS` | 允许的浏览器页面 Origin，公网模式必须配置 |
| `BACKEND_ENV_FILE` | 指定后台环境文件 |

运行时 `config.js` 中的 `null` 表示继承构建配置，`backendUrl: ''` 表示使用当前网站 `/lan`。

## 玩法与操作

支持团队歼灭、数据核心攻防，以及简单 / 普通 / 困难 AI。地图为 80 × 56 米，包含中央设施、南北翼和外环通路。玩家与 AI 共用移动碰撞、武器、伤害和目标规则；友方不受友伤。

| 队伍规模 | 战斗时长 / 回合 | 获胜所需回合 | 交换攻守间隔 |
| --- | --- | --- | --- |
| 1V1 | 80 秒 | 3 | 2 回合 |
| 2V2 | 95 秒 | 4 | 3 回合 |
| 3V3 | 110 秒 | 5 | 4 回合 |
| 4V4 | 125 秒 | 6 | 5 回合 |
| 5V5 | 140 秒 | 7 | 6 回合 |

准备阶段 15 秒，全部真人就绪可提前开始。核心安装和拆除各需 5 秒，上传需 30 秒；移动、受伤或松开交互键会取消安装 / 拆除。安装后攻击方全灭仍可能通过上传获胜。

七把枪械分别为步枪、手枪、霰弹枪、冲锋枪、射手步枪、轻机枪和狙击枪。另有手雷、烟雾弹和闪光弹，每回合配发 1 枚手雷、1 枚烟雾弹、2 枚闪光弹。手雷延时爆炸并造成范围伤害，墙体阻挡冲击，沿用关闭友军伤害的规则；烟雾持续 14 秒并遮挡玩家与 AI 视线；闪光会使视线内的角色短暂致盲，背对爆点可减轻效果，墙体和烟幕可阻挡闪光。离线和联机使用相同规则。支持装备选择、护甲、队伍指令、记分板、阵亡观战，以及画质、音量、灵敏度和 FOV 设置。

| 按键 | 操作 |
| --- | --- |
| WASD / 鼠标 | 移动 / 视角 |
| 左键 / 右键 | 射击 / 瞄准 |
| R | 换弹 |
| 1–7 | 切换枪械 |
| 8 / 9 / 0 | 选择手雷 / 烟雾弹 / 闪光弹，左键投掷 |
| 鼠标滚轮 | 切换全部武器 |
| Shift / Ctrl 或 C / 空格 | 冲刺 / 蹲伏 / 跳跃 |
| 按住 E / G | 目标交互 / 丢弃核心 |
| F1 / F2 / F3 / F4 | 跟随 / 固守 / 进攻 / 撤退 |
| Tab | 按住显示记分板 |
| ← / → | 阵亡后切换队友视角 |
| Enter / Esc | 准备就绪 / 释放鼠标与打开暂停菜单 |

## 开发与验证

```bash
npm test
npm run test:backend
npm run build
```

需要真实浏览器和 WebGPU 适配器的验收命令：

```bash
npm run test:webgpu
npm run test:browser
npm run test:visual
npm run test:startup
npm run test:arsenal
npm run test:audio
npm run test:render-work
npm run benchmark:rendering
```

可用 `CHROME_PATH` 指定 Chrome / Edge。浏览器检查产生的截图与报告保存在 `artifacts/`。通过 `?debug=1` 提供测试入口 `window.__BLA`。

```text
frontend/             独立前端、静态素材、构建与开发服务
  src/game/           离线规则、移动与网络预测
  src/visual/         WebGPU 渲染、角色和枪械
  public/             打包素材与运行时配置
  deploy/nginx.conf   HTTPS 静态服务和 WebSocket 代理模板
backend/              独立 Rust 后台
  src/game.rs         AI、武器、回合与目标规则
  src/server.rs       房间与权威模拟
  src/game-data.json  后台地图与规则数据
scripts/              联合启动、证书生成、素材处理与基准
tests/                规则、网络与浏览器检查
```

前后端可分别复制和构建：前端目录执行 `npm ci`、`npm run build`；后台目录执行 `cargo build --release --locked`。前后端独立保存规则数据，修改规则时需同步，测试会校验一致性。联机后台以 60 Hz 模拟、20 Hz 发送快照，客户端负责输入预测和显示插值。房间保存在单个后台进程内存，多实例部署需让同一房间的玩家连接相同实例。

## 素材与第三方许可

地图、枪械、角色几何、骨骼动画和音效由本项目程序生成。部分表面与服装纹理使用本地生图服务制作，来源和处理记录保存在 `frontend/public/art/manifest.json` 与 `frontend/public/art/characters/manifest.json`。游戏运行时加载打包素材，不调用生图服务或外部 CDN。

扫描材质 Concrete Floor 02、Concrete Wall 008 和 Empty Warehouse 01 HDR 来自 [Poly Haven](https://polyhaven.com/)，采用 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/legalcode)。具体来源、文件和转换记录保存在 `frontend/public/art/scanned/manifest.json`。

Three.js 及其工具模块使用 MIT 许可，授权原文如下；此授权适用于对应第三方代码。

```text
The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
