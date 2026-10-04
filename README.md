# Trauma Team International

这是一个致敬《赛博朋克2077》世界观中 Trauma Team International 的交互式解剖疼痛探索与日常参考工具。

页面把部位、疼痛感觉、外部表现编码为本地特征，通过 `data/knowledge.json` 中的规则输出最多六条“创伤小组评估”。每条结果至少包含两项不同依据，其中至少一项是与部位匹配的症状。卡片依次展示病症、判断依据、症状、诱因、建议和阈值。没有大模型或远程推理 API。

## 开发

```bash
npm install
npm run dev
```

## 构建 / GitHub Pages

```bash
npm run build
# 将 dist 发布到 GitHub Pages（项目 Pages 设为 GitHub Actions 或上传 dist）
```

## 模型与许可

模型资源来自 Anatria-3D 的公开男性 GLB：
https://github.com/Nurkan1/Anatria-3D/tree/main/public/anatomy

界面提供骨骼、肌肉、内脏三层，神经层暂时停用。肌肉保留原 `nervous_male.glb` 中全部 274 个肌肉相关结构，并从同一图谱的 `muscular_male.glb` 补齐缺失肌肉，共 636 个可选结构，包含双侧腹直肌、腹外斜肌、腹内斜肌和腹横肌。补充时排除会遮住肌肉的被覆筋膜和重复切面；名称、侧别和原始解剖坐标保留。

内脏共 30 个可选结构，来自 `visceral_male.glb`、心血管图谱的四个心腔及淋巴图谱的脾。心腔离线合并为“心脏”，肺叶分别合并为“左肺”和“右肺”；每个整体使用一个可点击、可完整高亮的网格。还包含肝胆、胃肠、胰脾及泌尿结构，并提供按器官筛选的感觉、表现和评估规则。没有用重叠的肝段、胃黏膜或胸膜覆盖器官表面。

资源本地托管，不依赖运行时第三方下载。此版覆盖主要胸腹内脏；原图谱缺少回肠、盲肠、直肠等结构，未用合成模型补造，不代表完整内脏图谱。

这些文件来自 Z-Anatomy / BodyParts3D 衍生数据，仓库标注 CC BY-SA 4.0；使用时应保留署名与相同许可要求。当前使用男性模型，不代表完整男女双套解剖覆盖，继续保留 NOTICE/署名。

## 模型与渲染优化

运行 `npm run optimize:anatomy`（`optimize:muscle` 仍为兼容别名）重新生成资源和 `public/anatomy/optimization-report.json`。使用 glTF Transform、Meshoptimizer 减面和 Draco 压缩；锁定网格边界，小于 100 面的结构不减面，较大的结构至少保留 64 面。桌面与手机版本拥有相同的结构名称和点击范围。

| 图层 | 桌面文件 / 三角面 | 手机文件 / 三角面 |
| --- | --- | --- |
| 骨骼 | 2.824 MB / 820,659 | 0.862 MB / 144,579 |
| 肌肉 | 3.471 MB / 606,020 | 2.064 MB / 209,068 |
| 内脏 | 0.535 MB / 161,113 | 0.250 MB / 64,145 |

肌肉补齐后的未减面基准为 2,042,488 面；手机资源减少约 90%。手机、节流网络、内存不超过 4 GB 或不超过四个逻辑处理器的设备直接请求轻量资源，像素比上限为 1；不先下载高精度版本。Draco 解码工作线程在这些设备上限制为一个。首屏 UI 与 3D 模块分开加载，首屏只加载骨骼，其他图层按需下载。

运行时为可选结构建立 BVH，点击只替换选中结构的材质。切换图层复用 WebGL 画布；相机、选中状态、模型或视口改变时重绘几何，静止时只刷新缓存画面的电视后处理（手机目标 12 帧/秒，桌面 24 帧/秒），切换动画期间目标 60 帧/秒。后台页面停止定时刷新；减少动态效果的系统设置关闭持续刷新。部位白色文字不接收点击，始终位于弹出面板下方。

`organ-supplement-source.glb` 是从上游心血管/淋巴资源中提取的原始心腔和脾网格。需要重新提取时，检出上游提交 `6f464dfec563352ea4eebd1219f4866a14e7dbf8`，运行 `node scripts/optimize-anatomy.mjs /path/to/Anatria-3D/public/anatomy`。

`npm run test:models` 校验名称完整性、心肺合并后的解剖位置与整体选择、手机减面、面数与体积，以及普通射线与 BVH 的命中一致性。工具依据：[glTF Transform](https://gltf-transform.dev/)、[three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)、[React Three Fiber 按需渲染](https://r3f.docs.pmnd.rs/advanced/scaling-performance)。旧手机性能仍需实机测试；桌面浏览器的移动模拟不等同于实际手机 GPU。

## 医疗边界

排序使用本地规则匹配分，不是患病概率。诱因字段列出一般相关因素，并不表示已确认使用者的病因。“阈值”列出需要进一步评估或紧急就医的具体条件，紧急信号独立于卡片匹配展示。

牙痛、扭伤和腹部紧急信号的校核参考：[NHS 牙痛](https://www.nhs.uk/symptoms/toothache/)、[NHS 扭伤与拉伤](https://www.nhs.uk/conditions/sprains-and-strains/)、[NHS 阑尾炎](https://www.nhs.uk/conditions/appendicitis/)。现有规则仍需专业审阅与临床验证。

新增内脏规则参考：[NHS 心脏病发作](https://www.nhs.uk/conditions/heart-attack/)、[UCLH 急性胰腺炎](https://www.uclh.nhs.uk/patients-and-visitors/patient-information-pages/acute-pancreatitis)、[NHS 肝炎](https://www.nhs.uk/conditions/hepatitis/)、[NHS Inform 脾脏疾病与损伤](https://www.nhsinform.scot/illnesses-and-conditions/stomach-liver-and-gastrointestinal-tract/spleen-problems-and-spleen-removal/)。这些规则表示评估方向，不通过模型点击确认病变器官。
