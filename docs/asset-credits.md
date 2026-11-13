# 第三方素材与来源

## 原创士兵模型与动画

- 当前角色为本项目原创的 **BLA Sentinel** 程序化战术士兵，源文件：`src/visual/original-soldier.js`。
- 人体与装备几何、33 关节骨骼和 Idle / Walk / Run 动画由本项目代码构建，没有导入第三方人物网格、骨骼或动作。第二版使用连续曲面和混合蒙皮连接肩颈、肘膝，配合衣褶、贴身背心和圆弧靴型。
- 制服与背心的基础材质通过用户授权的本地生图服务制作；颜色、近似微表面法线和粗糙度共六张 1K 本地 WebP，见 `public/art/characters/manifest.json`。迷彩叠加和阵营配色由项目代码处理；辅助通道为近似处理，并非扫描重建。运行时不调用生图服务。
- 装备包括头盔、护目镜、面罩、耳机、夜视仪安装座、防弹背心、弹匣袋、电台、背包、腰带、护膝和战术靴。野战配色为军绿 / 沙色，城市配色为深灰 / 黑色；配色随攻守方交换，沿用原有阵营标识规则。
- 每个角色使用独立克隆的骨骼，几何和材质共享；持枪与蹲伏由项目自有的双骨 IK 适配。
- 项目此前使用 three.js 示例中的 Adobe Mixamo Vanguard / Soldier.glb。该人物已被替换，旧文件已移除；当前运行和发布不需要 Mixamo 人物素材。
- Three.js、SkeletonUtils 与 RoundedBoxGeometry 仍为 MIT 许可的工具代码，详见下方说明；这些工具不提供本项目的人物造型和动画数据。

## 渲染代码与程序化资产

three.js 及使用的 GLTFLoader、SkeletonUtils、RoundedBoxGeometry、RoomEnvironment 与后处理模块采用 MIT 许可，原始许可见 [licenses/threejs.txt](licenses/threejs.txt)。

地图与枪械几何、第一人称手套与袖子造型、标识牌、粒子、弹着痕迹及音效由本项目程序生成。混凝土、地面、金属、织物与设备面板的基础颜色贴图使用用户提供的本地文字生图服务生成，辅助法线与粗糙度经本地处理，详见 [generated-art.md](generated-art.md) 和 `public/art/manifest.json`。人物使用上文所述原创几何、骨骼和动画，以及本地生图服务制作的布料和尼龙材质。地图装饰沿既有碰撞表面布置，未通过视觉升级修改对战规则或地图碰撞布局。
