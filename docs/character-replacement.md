# 原创战术角色 · 第三版

当前使用项目原创 BLA Sentinel 角色。第三版继续针对人偶感调整人体比例、装备轮廓和持枪动作，保留第二版通过本地生图服务制作的布料材质。没有采用此前调研的 Sketchfab SWAT 候选或其他第三方人物模型。

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
- 军绿迷彩 / 沙色装备与深灰制服 / 黑灰装备沿用攻守阵营切换规则。

这是向写实战术人物方向的改版，实际效果见实机截图；自动化测试只验证变形和资源正确性，不等于达到 CS 的美术品质。

## 生图材质

通过用户授权的 `D:/dev/Image-generation` 服务，逐张生成防撕裂制服布料和背心尼龙基础颜色贴图。生成提示词和处理记录保存在 `public/art/characters/manifest.json`。

- 发布文件：`public/art/characters/soldier-{fabric,nylon}-{albedo,normal,roughness}.webp`。
- 每张贴图为 1024 × 1024；颜色使用 sRGB，法线和粗糙度使用线性数据。
- 处理包括亮度归一化、边缘匹配、近似微表面法线和保守粗糙度；这些不是经标定的扫描 PBR 材质。
- 迷彩由代码叠加到制服颜色上；生成服务仅用于制作阶段，游戏运行只加载本地文件。
- 原始源图、生成元数据和 3 × 3 平铺检查图保存在不提交的 `artifacts/`。

复现命令（需要本地生图服务已启动；生成脚本保留已有结果）：

```sh
node scripts/generate-art.mjs soldier-fabric
node scripts/generate-art.mjs soldier-nylon
node scripts/process-art.mjs --characters soldier-fabric soldier-nylon
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
