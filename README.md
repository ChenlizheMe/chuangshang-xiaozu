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

界面只提供骨骼和肌肉两层。骨骼使用 `skeletal_male.glb`；肌肉使用从 `nervous_male.glb` 派生的 `muscle-optimized.glb`，神经层暂时停用。非肌肉结构在生成资源时移除，保留全部 274 个可选结构的名称、坐标和独立高亮。资源文件名不能作为组织类型的判断依据，点击名称与临床区域仍按实际节点识别。资源本地托管，不依赖运行时第三方下载。

这份肌肉资源不包含腹直肌、腹外斜肌、腹内斜肌和腹横肌等腹壁结构，当前不能通过模型点击这些缺失区域；对应的腹部分析规则保留在知识库中。它不代表完整肌肉图谱。

这些文件来自 Z-Anatomy / BodyParts3D 衍生数据，仓库标注 CC BY-SA 4.0；使用时应保留署名与相同许可要求。当前使用男性模型，不代表完整男女双套解剖覆盖，继续保留 NOTICE/署名。

## 肌肉模型优化

运行 `npm run optimize:muscle` 可从仓库保留的原始模型重新生成优化资源和 `muscle-optimized.json` 报告。使用 glTF Transform、Meshoptimizer 减面和 Draco 压缩；锁定网格边界，限制误差为模型半径的 0.2%，小于 100 面的结构不减面。文件体积由 8,535,424 字节降至 1,456,856 字节；可见三角面由 832,780 降至 340,498。

运行时为可选结构建立 BVH，鼠标命中使用每块结构的最近交点；点击只替换选中结构的材质，避免每次选中都更新整个模型的材质。电视后处理保持现有画面效果。

`npm run test:models` 校验名称完整性、解剖位置和边界、面数与体积，以及普通射线与 BVH 的命中一致性。工具依据：[glTF Transform](https://gltf-transform.dev/)、[three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)。

## 医疗边界

排序使用本地规则匹配分，不是患病概率。诱因字段列出一般相关因素，并不表示已确认使用者的病因。“阈值”列出需要进一步评估或紧急就医的具体条件，紧急信号独立于卡片匹配展示。

牙痛、扭伤和腹部紧急信号的校核参考：[NHS 牙痛](https://www.nhs.uk/symptoms/toothache/)、[NHS 扭伤与拉伤](https://www.nhs.uk/conditions/sprains-and-strains/)、[NHS 阑尾炎](https://www.nhs.uk/conditions/appendicitis/)。现有规则仍需专业审阅与临床验证。
