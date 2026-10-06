# Trauma Team International

这是一个致敬《赛博朋克2077》世界观中 Trauma Team International 的交互式解剖疼痛探索与日常参考工具。

页面支持骨骼、肌肉、内脏单选部位，再次点击取消；选择新部位或切换图层会清空上一处的症状。通过按钮勾选感觉、伴随表现、时间、诱因，无需输入文字。时间和诱因分别显示，持续时间选项互斥。页面固定一屏，只有弹出面板内部滚动。画面保留深灰黑与橙色、无边框弹性按钮、电视后处理、磁带设备刻度和工业排版。

评估完全在设备本地运行，不上传身体描述，没有大模型或远程推理 API。`data/knowledge.json` 提供 75 个评估方向及中英文短文案，`src/clinicalRules.js` 定义每个方向的关键特征组合，`src/basicAssessments.js` 提供少量信息下的区域性基础分析。最多输出六条“创伤小组评估”，卡片依次展示病症、判断依据、症状、诱因、建议和阈值，不显示药物信息。

## 推断逻辑与知识整理

- 具体病症卡片必须满足所有必需的特征组，并有至少两类独立证据。组内是备选描述，组之间共同成立；部位名称与同义疼痛词不重复计数。没有勾选表示未知，不表示检查阴性。
- 未满足具体病症条件时，已有感觉、表现或症状相关诱因时，可以给出一条标有“基础分析”的宽泛方向。基础卡只展示实际输入的依据，不捏造第二条证据；仅选择部位或纯持续时间不生成病症。没有具体病症时才使用基础卡，避免重复结果。
- 例如选牙齿并勾选“紧绷”，会给出咬合负荷相关不适、可能的咬紧牙或磨牙因素和放松下颌等建议；不会因此输出牙髓炎。持续冷热痛和自发痛等关键特征完整时，再显示相应具体病症。基础分析不是确诊，也不是概率预测。
- 时间和诱因使用不同选项组，持续时间互斥；夜间痛、夜间麻木归入时间。移除了自由描述及其词典解析，不再要求打字，也不再把隐藏文字作为推断输入。腹部仍可用按钮确认实际象限。
- 单条危险信号独立优先展示；没有具体病症卡片时，基础分析也会转为需要优先检查的方向，不用劳损或休息建议淡化急症。
- 删除了未分型头痛、左右腹内脏不适等占位卡片，并合并重复的神经痛、关节肿痛与皮肤炎症方向。分别处理牙髓炎、龋病、牙本质敏感，牙龈炎与牙周支持组织异常，过敏性鼻炎与鼻窦炎，下尿路感染与肾感染，反流与餐后消化不良，外伤性与应力性骨损伤。变更清单见 `data/clinical-audit.json`。
- 新增睡眠不足、久坐、久站、延迟性运动酸痛、缺水、屏幕相关眼干、便秘、反复肠易激样不适等方向。急症信号出现时不输出生活方式解释作为安抚。单条危险信号即使未达到病症卡片的证据门槛，也会优先提示处理。

未引入 SVM：目前没有经过标注与外部验证的病例训练集，换一个模型名称不能保证推断质量。此版使用可检查的显式规则与语义证据分组；排序分不是置信度或患病概率，不输出“确诊”。若将来使用学习模型，需要独立训练/测试病例、敏感度与特异度评估，并保留独立急症分流。

`npm run test:engine` 覆盖合成病例测试，包括具体病症的正反例、单个模糊感觉、牙齿紧绷、时间与诱因、单选替换、移除文字后的输入行为、急症保留及全部 1,001 个可选结构的基础分析路径。桌面 Node 单部位推断平均约 0.02 ms；这不是旧手机实机或临床准确率测量。浏览器检查覆盖真实牙齿点击、单选高亮与替换、持续时间互斥、基础/具体卡片和 320×568 至 1440×900 的一屏布局。

## 开发

```bash
npm install
npm run dev
```

## 构建 / GitHub Pages

```bash
npm run build
# main 分支推送后，由 .github/workflows/deploy.yml 自动构建并发布 dist
```

正式域名为 `traumateam.cn`。`public/CNAME` 会随 Vite 构建进入 `dist/CNAME`；仓库 Pages 的发布源设为 **GitHub Actions**，Custom domain 设为 `traumateam.cn`。Actions 发布时域名绑定以仓库 Pages 设置为准，单独提交 CNAME 文件不会设置该绑定。

在域名平台添加以下记录，TTL 使用默认值即可：

| 主机记录 | 类型 | 记录值 |
| --- | --- | --- |
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |
| `www` | CNAME | `chenlizheme.github.io` |

若已有 `@` 或 `www` 的停放页/旧网站记录，应替换冲突记录；保留邮箱等用途的 MX、TXT 记录。CNAME 记录值不包含 `https://` 或仓库路径。使用上述配置后，`www.traumateam.cn` 会重定向到主域名。

DNS 生效与 HTTPS 证书签发可能需要最多 24 小时。解析检查通过后，在仓库 **Settings → Pages** 确认 **Enforce HTTPS** 已勾选。IPv6 可按需要增加 GitHub Pages 的四条 AAAA 记录。解析及域名配置依据：[GitHub 自定义域名文档](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)。

## 模型与许可

模型资源来自 Anatria-3D 的公开男性 GLB：
https://github.com/Nurkan1/Anatria-3D/tree/main/public/anatomy

界面提供骨骼、肌肉、内脏三层，神经层暂时停用。肌肉保留原 `nervous_male.glb` 中全部 274 个肌肉相关结构，并从同一图谱的 `muscular_male.glb` 补齐缺失肌肉，共 636 个可选结构，包含双侧腹直肌、腹外斜肌、腹内斜肌和腹横肌。补充时排除会遮住肌肉的被覆筋膜和重复切面；名称、侧别和原始解剖坐标保留。

内脏共 30 个可选结构，来自 `visceral_male.glb`、心血管图谱的四个心腔及淋巴图谱的脾。心腔离线合并为“心脏”，肺叶分别合并为“左肺”和“右肺”；每个整体使用一个可点击、可完整高亮的网格。还包含肝胆、胃肠、胰脾及泌尿结构，并提供按器官筛选的感觉、表现和评估规则。没有用重叠的肝段、胃黏膜或胸膜覆盖器官表面。

全部 GLB 已提交在仓库的 `public/anatomy/`，构建后随网站发布。运行时使用 `./anatomy/…`，正式网站从 `https://traumateam.cn/anatomy/…` 同源加载，不从 GitHub Raw 或第三方模型站下载。国内 DNS 提供域名解析，不改变 GitHub Pages 的资源托管线路，也不保证首次模型下载更快。DNS 与托管的区别参考 [Cloudflare DNS 说明](https://developers.cloudflare.com/learning-paths/cybersafe/concepts/what-is-dns/) 与 [GitHub Pages 说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)。此版覆盖主要胸腹内脏；原图谱缺少回肠、盲肠、直肠等结构，未用合成模型补造，不代表完整内脏图谱。

这些文件来自 Z-Anatomy / BodyParts3D 衍生数据，仓库标注 CC BY-SA 4.0；使用时应保留署名与相同许可要求。当前使用男性模型，不代表完整男女双套解剖覆盖，继续保留 NOTICE/署名。

## 模型与渲染优化

运行 `npm run optimize:anatomy`（`optimize:muscle` 仍为兼容别名）重新生成资源和 `public/anatomy/optimization-report.json`。使用 glTF Transform、Meshoptimizer 减面和 Draco 压缩；锁定网格边界，小于 100 面的结构不减面，较大的结构至少保留 64 面。桌面与手机版本拥有相同的结构名称和点击范围。

| 图层 | 桌面文件 / 三角面 | 手机文件 / 三角面 |
| --- | --- | --- |
| 骨骼 | 2.824 MB / 820,659 | 0.862 MB / 144,579 |
| 肌肉 | 3.471 MB / 606,020 | 2.064 MB / 209,068 |
| 内脏 | 0.535 MB / 161,113 | 0.250 MB / 64,145 |

肌肉补齐后的未减面基准为 2,042,488 面；手机资源减少约 90%。手机、节流网络、内存不超过 4 GB 或不超过四个逻辑处理器的设备直接请求轻量资源，像素比上限为 1；不先下载高精度版本。Draco 解码工作线程在这些设备上限制为一个。首屏 UI 与 3D 模块分开加载，首屏只加载骨骼，其他图层按需下载。

三层共享同一模型坐标系、缩放和相机目标；切换内脏层不再额外将相机距离缩为 65% 或将目标上移 0.2 m。手动旋转、缩放和平移会保留。模型测试验证心肺与胸骨/锁骨的相对高度、心脏位于胸骨后方以及膀胱位于骨盆范围；浏览器同时检查手机和桌面的切层投影不变。

运行时为可选结构建立 BVH，点击只替换选中结构的材质。切换图层复用 WebGL 画布；相机、选中状态、模型或视口改变时重绘几何，静止时只刷新缓存画面的电视后处理（手机目标 12 帧/秒，桌面 24 帧/秒），切换动画期间目标 60 帧/秒。后台页面停止定时刷新；减少动态效果的系统设置关闭持续刷新。部位白色文字不接收点击，始终位于弹出面板下方。

`organ-supplement-source.glb` 是从上游心血管/淋巴资源中提取的原始心腔和脾网格。需要重新提取时，检出上游提交 `6f464dfec563352ea4eebd1219f4866a14e7dbf8`，运行 `node scripts/optimize-anatomy.mjs /path/to/Anatria-3D/public/anatomy`。

`npm run test:models` 校验名称完整性、心肺合并后的解剖位置与整体选择、手机减面、面数与体积，以及普通射线与 BVH 的命中一致性。工具依据：[glTF Transform](https://gltf-transform.dev/)、[three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)、[React Three Fiber 按需渲染](https://r3f.docs.pmnd.rs/advanced/scaling-performance)。旧手机性能仍需实机测试；桌面浏览器的移动模拟不等同于实际手机 GPU。

## 医疗边界

排序使用本地规则匹配分，不是患病概率。诱因字段列出一般相关因素，并不表示已确认使用者的病因。“阈值”列出需要进一步评估或紧急就医的具体条件，紧急信号独立于卡片匹配展示。

牙痛、扭伤和腹部紧急信号的校核参考：[NHS 牙痛](https://www.nhs.uk/symptoms/toothache/)、[NHS 扭伤与拉伤](https://www.nhs.uk/conditions/sprains-and-strains/)、[NHS 阑尾炎](https://www.nhs.uk/conditions/appendicitis/)。现有规则仍需专业审阅与临床验证。

本轮分支参考：[AAE 牙髓诊断术语](https://www.aae.org/specialty/wp-content/uploads/sites/2/2017/07/aaeconsensusconferencerecommendeddiagnosticterminology.pdf)、[NHS 肾感染](https://www.nhs.uk/conditions/kidney-infection/)、[NHS 反流](https://www.nhs.uk/conditions/heartburn-and-acid-reflux/)、[NHS 消化不良](https://www.nhs.uk/conditions/indigestion/)、[NHS 便秘](https://www.nhs.uk/conditions/constipation/)、[NHS IBS 症状](https://www.nhs.uk/conditions/irritable-bowel-syndrome-ibs/symptoms/)、[NHS 疲劳](https://www.nhs.uk/symptoms/tiredness-and-fatigue/)、[Moorfields 眼干](https://www.moorfields.nhs.uk/eye-conditions/dry-eye)、[NHS 关节感染](https://www.nhs.uk/conditions/septic-arthritis/)。胸骨压痛不能直接推断白血病；胸壁痛和需血液检查的异常出血、淤青组合分别参考 [NHS 肋软骨炎](https://www.nhs.uk/conditions/costochondritis/) 与 [NHS 急性髓系白血病症状](https://www.nhs.uk/conditions/acute-myeloid-leukaemia/symptoms/)。代码与文案审查不等于医师审阅或临床验证。

新增内脏规则参考：[NHS 心脏病发作](https://www.nhs.uk/conditions/heart-attack/)、[UCLH 急性胰腺炎](https://www.uclh.nhs.uk/patients-and-visitors/patient-information-pages/acute-pancreatitis)、[NHS 肝炎](https://www.nhs.uk/conditions/hepatitis/)、[NHS Inform 脾脏疾病与损伤](https://www.nhsinform.scot/illnesses-and-conditions/stomach-liver-and-gastrointestinal-tract/spleen-problems-and-spleen-removal/)。这些规则表示评估方向，不通过模型点击确认病变器官。

基础牙齿负荷分支参考：[NIDCR 磨牙与咬紧牙](https://www.nidcr.nih.gov/health-info/bruxism/)、[NHS 牙痛](https://www.nhs.uk/symptoms/toothache/)。紧绷只是一个可用观察线索，磨牙与牙体病变仍需要口腔检查区分。

模型与 Draco 解码器使用独立的 `models-v5` 缓存，页面使用 `shell-v10` 缓存。更新界面时保留已下载的模型，并迁移旧页面缓存中的当前模型，减少重复下载；没有缓存的模型断网时返回资源错误，不用 HTML 页面冒充 GLB。`npm run test:cache` 覆盖升级、缓存命中、断网和错误响应；生产浏览器验证已缓存的手机版骨骼可断网重载。模型更新时需同步修改运行时 URL 的版本和 `public/sw.js` 中的 `MODEL_VERSION`；解码器更新时也应调整缓存版本。这改善回访和页面更新时的加载，首次下载仍由实际网络线路决定。


## 回归验证

运行 `npm run check` 一次执行全部 Node 回归与生产构建。Pages 工作流使用锁文件安装依赖，并在测试失败时阻止部署。回归覆盖名称与模型完整性、单部位状态、规则证据、危险信号、缓存升级及断网；合成输入的规则回归不表示临床准确率或真实设备性能验证。

离线缓存只保留成功的 HTML 导航响应。上游 404/5xx 不会覆盖可用首页；缺失的脚本、样式与二进制资源返回真实资源错误，不会用 HTML 冒充。浏览器限制缓存或存储已满时，成功的在线响应仍正常提供。


危险信号回归同时验证“现有按钮可见”和“所选组合能触发优先处理”，覆盖腹壁突发剧痛、牙痛相关呼吸/吞咽困难、不同胸痛描述与伴随信号、盆腔与妊娠/晕厥，以及侧腰痛伴发热和血尿。未增加症状或病种选项。依据：[NHS 胸痛](https://www.nhs.uk/symptoms/chest-pain/)、[NHS 腹痛](https://www.nhs.uk/symptoms/stomach-ache/)、[NHS 牙脓肿](https://www.nhs.uk/conditions/dental-abscess/)、[NHS 盆腔痛](https://www.nhs.uk/symptoms/pelvic-pain/)、[NHS 肾感染](https://www.nhs.uk/conditions/kidney-infection/)。这些是保守就医提示，不确定病因，也不等于临床验证。

现有位置确认已覆盖有侧腰/尿路线索的腰背、髋部和盆腔区域；复用现有位置，不从模型点位自动推断。基础卡不再遮掉待确认位置。胸部/食管反流方向不再强求腹部象限，但急症分流保持独立。右下腹迁移线索只补足阑尾方向的未知位置，不再绕过其他象限的门槛。牙髓方向不再把“持续冷热痛/自发痛 + 普通疼痛同义词”作为两条独立特征，仍需特征性观察。耻骨肌归入髋部，髓核归为椎间盘骨骼结构。参考：[AAE 牙髓诊断](https://www.aae.org/specialty/wp-content/uploads/sites/2/2017/07/endodonticdiagnosisfall2013.pdf)、[华盛顿大学耻骨肌解剖](https://rad.uw.edu/muscle-atlas/pectineus)。独立审查的24例安全矩阵已纳入自动回归。

可达性夹具还覆盖当前模型对应的74条现有规则：测试逐字段按钮可见性、位置可选性和最终分支。第75条自主神经规则没有当前模型入口，单独记录为未启用而非伪造可达；这些由规则生成的夹具仅验证软件路径，不能代替独立病例或临床评估。

英文结果字段补齐了33处中文占位，并用自动测试检查英文不含汉字。一般吞咽困难不再等同于已无法吞咽液体；牙齿/颌面肿胀或感染表现伴吞咽困难仍明确急诊。参考：[NHS 吞咽困难](https://www.nhs.uk/symptoms/swallowing-problems-dysphagia/)。

单独勾选尿痛、尿频、尿急时，基础分析使用排尿相关宽泛提示，不会按点到的腰背/髋结构解释为劳损。单独侧腰痛仍保留肌骨与尿路多种可能；未勾发热不表示已排除发热。尿路变化伴发热/寒战、或血尿的优先处理保留。既有具体规则的证据门槛不变。依据：[NHS 尿路感染](https://www.nhs.uk/conditions/urinary-tract-infections-utis/)、[MedlinePlus 尿痛](https://medlineplus.gov/ency/article/003145.htm)、[MedlinePlus 侧腰痛](https://medlineplus.gov/ency/article/003113.htm)。


## 界面与包体积回归（2026-10-06）

按钮、平移滑块与弹层使用浏览器原生短过渡，移除仅承担界面动画的 GSAP 和逐按钮监听器。系统要求减少动态效果时，界面过渡与释放后的旋转/缩放惯性停止；原有按需3D渲染与静止后处理节流保留。Escape关闭面板并返回触发按钮，手机按钮点击区至少44px；空选择提示缩成较小面板，完整英文部位名降低字号以少遮挡模型。中文品牌统一“创伤小组”。

以同一云执行器 Node 24、Vite 5.4.21 分别重建优化前提交97147f7和当前源码，HTML首屏直接引用及预加载的JS合计gzip从156,550字节降至128,728字节，约减少17.8%。口径为gzip level 9，不包含按需加载3D模块、模型或网络延迟；不是手机GPU或加载秒数实测。运行 `npm run build && npm run measure:bundle` 可重复测量。

仪器化表现参考 [Sony TPS-L2](https://www.sony.com/en/SonyInfo/design/bside/01_throwback_walkman/) 与 [V&A 的 Braun / Dieter Rams 设计资料](https://www.vam.ac.uk/articles/dieter-rams-a-brave-new-world-of-product-design)：保留现有主视窗、有限成组按键和橄榄/炭黑/暖橙，资料卡减少重复投影，没有添加持续耗电特效。


缓存升级回归额外覆盖“新页面资源仍被旧Worker下载”的交接期。升级后保留最近一代含运行时资源的页面缓存供旧标签页/断网资源使用，但离线导航只取当前首页；更旧页面缓存继续回收，模型仍独立保留。脚本或样式收到上游200 HTML也会被拒绝，避免把错误首页缓存为JS/CSS。


首轮工程校验共280个自动测试，其中一项遍历51种实际图层/区域/组织/器官组合的3,352个单一观察输入，验证单个观察不会产生具体病种卡；另覆盖症状重复、顺序改变、未知输入隔离和既有74条可达路径。全部仍是合成软件回归。骨骼335、肌肉636、内脏30，共1,001个可选结构；16个解剖/解码文件与本轮基线552bd9d逐字节一致。

窄屏英文报告将字段名与内容分行，避免SYMPTOMS等长标签挤进正文。真实云浏览器复验使用软件WebGL，不代表低端手机GPU、Safari/iOS、触屏多指或临床效果验证。


## 专业资料驱动复核

2026-10-06新增的资料对照、适用范围、未能证明的内容和合成正反例记录在 `data/evidence-review-2026-10.json`。分流动作与参考匹配评分分开，区分立即、当天和尽快评估；优先信号存在时，保留的参考卡不再同时给出冲突的居家处理建议。优先卡不用数字名次，不能把顺序读作概率或确诊。共存信号按实际紧迫性排序，未勾选不作阴性；位置、时序或“可能怀孕”单独不补造腹痛事实。


神经/肌骨资料批次依据SANJO、ICHD-3和MSD/Merck专业版，补充已有热肿/流脓关节、头痛伴警讯、突然力量下降、发热颈背痛、运动后疼痛与尿色/力量变化、损伤后功能丧失的分流。规则只使用既有选择；危险信号不依所点模型是骨还是肌。明确呕吐不再被普通紧张型头痛解释；对称手足模式、沿腿放射分别需要真实分布依据，泛化与具体放射不重复计数。具体门槛是保守的软件展示策略，不能用来排除真实疾病或代替临床标准。


胸腹/泌尿资料批次对照EAU、MSD专业版、AHA/ACC和NIDDK，补足呕血跨所选区域、外伤后左上腹/肩尖警讯、肾绞痛伴发热、右上腹炎症组合、上腹持续加重伴呕吐及便秘危险表现。明确表达疼痛的现有标签不要求重复勾泛疼痛；远位肩尖/侧腰痛不冒称本地上腹痛。胸壁压痛或活动时胸闷合并气短/冷汗仍需优先评估，不能凭“像胸壁痛”排除更紧急原因。新增参考分支为零，具体病名证据门槛不因这些分流调整而放宽。

### 资料审查闭环与可重复验证（2026-10-06）

本轮按公开专业指南、教材章节和官方健康资料核对现有规则。完整来源、修改决定、正反例、适用范围和未能确认的事实记录在 [`data/evidence-review-2026-10.json`](data/evidence-review-2026-10.json)：36项实施记录，以及输入不足、证据不足、未验证等保留边界。来源包括SANJO、ICHD-3、EAU、MSD/Merck专业版、AAE教育资料、Elsevier Complete Anatomy、UAMS/UW解剖教学资料及NHS/NIDCD/NIDDK。只使用实际读取的有关章节；这不表示读完全部书籍、得到机构认可或完成临床验证。

- 已处理：优先就医动作与参考卡护理冲突；神经/关节/胸腹泌尿/牙科五官/皮肤危险组合；未收集的疼痛、侧别、起点、体征或起病事实；复合解剖名称错误归区；明确时程与典型头痛参考不一致；重复与换序输入的输出漂移。
- 保留限制：没有年龄、完整发作史、检查、化验或影像，不能实现完整诊断标准、Ottawa拍片决定、听力亚型、出血量/是否已止或确认器官病变。无意中体重下降的原因、力量下降是否客观及眼内/眼周流脓等仍需核实。没有为补齐这些信息新增输入或模型。
- 不作无依据扩展：没有把相似感觉词在所有病种中一律视为同义，没有添加处方、具体用药、影像决定或新的诊断模型；现有autonomic条目因没有当前三层模型入口，仍明确不可达。

`npm run check`运行466个测试并构建。其中跨专科性质测试使用655条带来源的合成输入：验证真实模型/选择器可达、6,891次危险观察增加不降级、1,310次重排/重复的完整输出一致、655次未知API词隔离，以及10组同部位/明确同分区跨图层动作一致。74条既有病种路径仍可达；这些路径夹具是软件可达性证据，不是独立临床真值。全部211个输入ID及75个病种ID保留，模型资产不变。

性能核查使用云桌面Node v24.19.0，对同655输入交替运行7轮、每轮20,000次：8a0af91批次修改前后（同时包含证据顺序稳定化与参考文案/时程约束），中位单次评估约0.0334/0.0379毫秒。这里记录约0.0045毫秒的绝对代价，不把它称为性能提升，也不代表手机GPU、网络速度或实际用户诊断效果。
