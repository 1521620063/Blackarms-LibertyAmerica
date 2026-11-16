# 程序化战术场景升级

这版在现有 Three.js 项目中升级地图、双方人物、第一人称手臂与武器材质，方向是克制的工业军事设施。三角洲行动、CS、使命召唤作为视觉方向参考；当前仍是程序化 WebGL 资产，不代表达到这些商业游戏的最终美术质量。

## 地图与光照

`src/visual/facility-detail.js` 根据已有掩体类型构建不同的视觉结构：

- 货运集装箱：波纹侧板、角件、门缝、锁杆、搭扣和编号。
- 设备机柜：分仓面板、服务器层架、散热槽、把手和状态灯。
- 冷却机组：双风扇、轮毂、叶片、格栅及侧面百叶。
- 维修台与运输箱：抽屉、台面、金属锁扣、加强筋和嵌入式把手。
- 建筑细节：高窗、门楣管线、起重梁、吊架、混凝土拉结孔、货运地面字样和轮胎痕。

大体积掩体沿 `BOXES` 的实体轮廓布置；新增构件为表面浅浮雕、地面贴花与高处结构。共享碰撞和导航数据没有修改。

`src/world.js` 调整日光方向、环境补光、雾和泛光。中高画质使用 GTAO、后处理目标 MSAA、第一人称自阴影及附近顶灯投影；高画质使用两盏局部投影灯，中画质使用一盏。低画质关闭 GTAO、体积散射、阴影和泛光。标牌合入一张共享图集，静态场景仍为 31 个不透明材质批次。

混凝土和地面改用 Poly Haven 的 CC0 三通道 2K 材质，并使用 1K 仓库 HDR 经 PMREM 预过滤生成粗糙反射。扫描包约 15.85 MiB，来源见 [licenses/poly-haven-cc0.md](licenses/poly-haven-cc0.md)。旧版生成的混凝土 / 地面贴图不再重复加载。

天窗现在是屋顶真实开口，玻璃不投射实体阴影。`src/visual/atmosphere.js` 逐步采样场景深度和方向光阴影，产生受遮挡的单次散射；它不是体积全局光照。`src/visual/facility-occlusion.js` 沿共享碰撞轮廓生成静态地面遮蔽图，为远离动态投影灯的掩体与墙根保留接触阴影。方向光和枪械阴影相机在修改范围后显式更新投影矩阵。

## 人物与武器

人物第五版详见 [character-replacement.md](character-replacement.md)。双方装备几何不同，换边时会更换整个角色模板，而不是只换颜色。蒙皮、动画和 IK 继续用于所有队友与敌人。

`src/visual/tactical-gear.js` 提供曲线扫掠几何、程序化金属 / 聚合物 / 织物细节、第一人称袖子及手套。武器增加机械销、选择杆、背带环、部分枪型的导轨灯、压力线及枪口环。七种武器继续沿用原有枪口、瞄准和操作逻辑。

`ModelKit.batchWeapon()` 按材质合并静态零件并缓存几何；活动枪栓和透明镜片不参与合并。在相同双人展示场景中，绘制调用从升级前的 297 次降至 51 次。该数字来自同一套浏览器展示脚本，不是 FPS 测试，也不代表整场对战性能。

## 渲染后端

本轮保留 Three.js WebGLRenderer / WebGL2 后处理链。实际本地页面的浏览器检查记录了 `navigator.gpu` 与适配器均可用；这不等于已迁移 WebGPU，也不是两个后端的性能比较。后续若迁移，需要同时替换 GTAO、体积散射及材质着色钩子的实现，不能直接切换 Renderer 类名。

## 验证与查看

```sh
npm run build
npm test
npm run test:visual
npm run test:art
npm run test:arsenal
npm run test:browser
```

视觉检查覆盖独立骨骼、双方造型、换边后的模型与姓名、双方 × 七种武器 × 三个俯仰角 × 站立与蹲伏共 84 个握枪姿势、三档画质及其实际开关、绘制批次、资源及浏览器错误。材质检查验证本地扫描法线长度、数据色彩空间、HDR 来源及无外部运行时请求。规则测试覆盖比赛与武器逻辑；浏览器测试覆盖菜单、战斗、结算和双客户端局域网。

运行视觉检查后，在 `artifacts/` 查看：

- `visual-combat.png`：第一人称武器与双方角色。
- `original-soldiers-front.png` / `original-soldiers-back.png`：双方全身。
- `original-soldier-closeup.png` / `original-soldier-crouch.png`：近景与蹲伏。
- `map-north-freight.png` / `map-south-service.png` / `map-staging.png`：地图分区。
- `visual-report.json`：姿态误差、面数、绘制调用和自动化检查结果。

开发运行：`npm run dev`。截图是实际浏览器渲染结果；程序化造型、面部细节、布料变形及光照仍有明显的 WebGL 原型特征，后续要追求商业级写实效果，需要进一步制作雕刻烘焙资产、更细的角色拓扑与动画，以及逐场景的光照调校。
