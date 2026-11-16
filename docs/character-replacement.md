# 原创战术角色 · 第六版

当前使用项目原创 BLA Sentinel 野战侦察兵与 BLA Warden 城市守卫。双方有独立的装备几何模板，复用 33 关节骨骼命名和动作逻辑；每个角色仍克隆独立骨骼。布料沿用本地生成的材质。没有采用第三方人物网格或动画。

## 第六版改动

- 头盔壳体增加纵向截面密度，耳罩增加贴合内衬、侧导轨和固定点；护目镜下方与下颌增加浅薄护片及边缘线。保留 33 关节骨骼、双方独立模板与原有持枪接口。
- 通过 `C:/project/image` 的本地生图服务生成 `soldier-rubber` 防滑橡胶和 `soldier-helmet` 哑光复合涂层两张基础颜色素材；处理为各 1024² 的 albedo / 近似 normal / 估算 roughness，并只用于小面积橡胶和头盔壳。生成时服务读取更新后的 `.env`，运行时仅加载本地资源，不使用服务密钥。
- 校对角色贴图 UV 缩放：制服颜色图将微纹理和迷彩预合成，颜色图 1 倍、微法线和粗糙度 4 倍；其余映射材质的三个通道使用一致缩放。测试验证实际角色材质分配而不仅是文件存在。
- 实机近景、侧面与全身截图位于 `artifacts/original-soldier-*.png`，测试检查双方姿态和资源。画质仍明显受程序化形体、遮脸结构、蒙皮与动作质量限制，不能声称达到 CS2、《使命召唤》或《三角洲行动》的人物写实程度。WebGPU 本轮未迁移：切换渲染后端不能替代雕刻、拓扑、烘焙贴图与动作制作。

## 第五版改动

- 服装使用物理材质的织物边缘反光；头盔和金属增加连续、经过导数过滤的微表面变化。
- 肘膝加入不对称的压缩衣褶，保留原来的混合蒙皮和双骨 IK。
- 手指和拇指改为闭合的曲线扫掠曲面，绑定已有手指骨骼，替代独立椭球手指。
- 第一人称袖子复用当前阵营的制服材质，手套护片使用本地尼龙贴图；袖子和手指端部封闭。
- 枪械接收机、护木、枪托和瞄具收窄，圆柱零件单独调整半径，保留圆形枪管截面。枪口、握点与瞄准接口不变。

## 第四版改动

- Sentinel 增加折叠双筒夜视仪、围领和腰部医疗包；Warden 增加下颌护具、肩部护板和背部装备包。
- 双方都有胸前工具袋、布带、缝线、拉环和装备固定细节。迷彩改用曲线轮廓与较柔和的叠色，增强关节褶皱的几何与阴影。
- 阵营互换时同时替换装备几何和骨骼，保留角色名称与根节点世界变换。按各自模型尺寸计算缩放、落地高度和蹲伏偏移。
- 延长前臂与上臂的有效长度，覆盖夜视仪改变包围盒之后的狙击枪抬枪握点。
- 第一人称使用沿曲线扫掠的袖子、手指与拇指，加上掌背面料、指节和缝线；入口见 `src/visual/tactical-gear.js`。
- 枪械静态零件按材质合并并缓存，活动枪栓与透明瞄具保留独立结构。

地图、光照与验收截图见 [visual-upgrade.md](visual-upgrade.md)。

## 第三版改动

- 抬高肩线、缩短脸部纵向比例，同时修改几何和骨骼绑定位置；增加前倾、肩部前送和头部随瞄准方向转动。
- 头盔增加耳部侧切与导轨，镜片和衬垫贴合面部；鼻梁与下颌直接由面罩表面塑形。
- 背心改成弧面前后板和环绕躯干的侧围，加入独立弹匣、固定绳、边缘缝线、电台线和原创识别章。
- 减小布料微纹理尺寸，校正 UV 拉伸；改成宽缓的关节褶皱、宽松裤腿、嵌入式护膝与有鞋带和防滑底的靴子。
- 双手按武器握点定位，手掌独立转向；静止时按鞋底位置贴地，并补充接触阴影。
- 每帧先还原动画基础姿态再施加 IK，修复 AnimationMixer 跳过未变化关键帧时，蹲伏偏移和关节修正累积的问题。
- 视觉回归覆盖七种武器 × 三个俯仰角度 × 站立 / 蹲伏共 42 种姿态的双手定位。

## 造型与变形

- 人物主体改为轮廓截面插值形成的连续表面，肩颈相接；袖子与裤腿跨越肘部、膝盖，不再使用独立胶囊拼接。
- 关节使用混合蒙皮；保留 33 关节、独立骨骼和 Idle / Walk / Run 动作，并适配持枪与蹲伏 IK。
- 肩部、腰部、前臂、膝盖和小腿采用不同轮廓，加入不规则衣褶、自然收口和圆弧靴型。
- 背心改为肩部切角、侧面收腰的薄层护具，包含贴合肩部的背带、弹匣袋、电台、腰带和背部水袋包。
- 头盔顺着颅骨收形；面罩、弧面护目镜、耳机与麦克风独立构建。
- 军绿迷彩 / 沙色装备与灰蓝迷彩 / 黑灰装备沿用攻守阵营切换规则。

这是向写实战术人物方向的改版，实际效果见实机截图；自动化测试只验证变形和资源正确性，不等于达到 CS 的美术品质。

## 生图材质

原有制服布料和背心尼龙通过用户授权的本地服务生成；本轮橡胶与头盔涂层通过 `C:/project/image` 生成。生成提示词和处理记录保存在 `public/art/characters/manifest.json`。

- 发布文件：`public/art/characters/soldier-{fabric,nylon,rubber,helmet}-{albedo,normal,roughness}.webp`。
- 每张贴图为 1024 × 1024；颜色使用 sRGB，法线和粗糙度使用线性数据。
- 处理包括亮度归一化、边缘匹配、近似微表面法线和保守粗糙度；这些不是经标定的扫描 PBR 材质。
- 迷彩由代码叠加到制服颜色上；生成服务仅用于制作阶段，游戏运行只加载本地文件。
- 原始源图、生成元数据和 3 × 3 平铺检查图保存在不提交的 `artifacts/`。

复现命令（需要本地生图服务已启动；生成脚本保留已有结果）：

```sh
node scripts/generate-art.mjs soldier-fabric
node scripts/generate-art.mjs soldier-nylon
node scripts/generate-art.mjs soldier-rubber
node scripts/generate-art.mjs soldier-helmet
node scripts/process-art.mjs --characters soldier-fabric soldier-nylon soldier-rubber soldier-helmet
```

## 代码与验证

- `src/visual/original-soldier.js`：人体、装备、蒙皮、动作和材质。
- `src/visual/characters.js`：角色克隆、阵营材质、动画混合与 IK。
- `tests/visual.mjs`：六角色独立骨骼、混合权重、无外部模型加载、动画、蹲伏脚部位置、画质切换和截图。
- `tests/art.mjs`：人物贴图加载、色彩空间、解码后的平铺边缘与本地运行。

运行 `npm run build`、`npm run test:visual` 和 `npm run test:art` 后可查看：

- `artifacts/original-soldiers-front.png` / `original-soldiers-back.png`：双方全身展示。
- `artifacts/original-soldier-closeup.png`：头肩、衣料与背心近景。
- `artifacts/original-soldier-profile.png`：侧面检查人体和装备接触关系。
- `artifacts/original-soldier-crouch.png`：蹲姿对比。
- `artifacts/visual-soldier.png`：游戏场景内的角色。
- `artifacts/visual-report.json` / `generated-art-report.json`：检查报告。
