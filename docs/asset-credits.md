# 第三方素材与来源

## 人类士兵模型与动画

- 本地文件：`public/models/soldier.glb`（约 2.06 MiB，含贴图与骨骼动画）。
- 人物：Adobe Mixamo 的 Vanguard 人类士兵，采用头盔、全身护甲、双手、双腿和人类骨骼；游戏中所有 AI 队友和敌人使用此模型。
- 获取来源：three.js **r180** 示例的 [Soldier.glb](https://github.com/mrdoob/three.js/blob/r180/examples/models/gltf/Soldier.glb)，[上游动画示例](https://github.com/mrdoob/three.js/blob/r180/examples/webgl_animation_skinning_blending.html)。
- 模型内置动画：Idle、Walk、Run、TPose；游戏使用前三种，每位角色独立克隆骨骼，并叠加持枪手臂姿态与蹲伏腿部 IK。
- Mixamo 模型和动画的使用说明见 [Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)。人物是第三方素材，并非本项目原创；three.js 的 MIT 代码许可不应被理解为将第三方人物重新许可为 MIT。
- 贴图与动画均随模型在本地提供，运行时无需访问 Adobe、GitHub 或 CDN。

## 渲染代码与程序化资产

three.js 及使用的 GLTFLoader、SkeletonUtils、RoundedBoxGeometry、RoomEnvironment 与后处理模块采用 MIT 许可，原始许可见 [licenses/threejs.txt](licenses/threejs.txt)。

地图与枪械几何、第一人称手套与袖子造型、标识牌、粒子、弹着痕迹及音效由本项目程序生成。混凝土、地面、金属、织物与设备面板的基础颜色贴图使用用户提供的本地文字生图服务生成，辅助法线与粗糙度经本地处理，详见 [generated-art.md](generated-art.md) 和 `public/art/manifest.json`。人物继续使用上述第三方模型与原始角色贴图。地图装饰沿既有碰撞表面布置，未通过视觉升级修改对战规则或地图碰撞布局。
