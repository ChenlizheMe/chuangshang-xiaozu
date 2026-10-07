创伤小组的首个 Android 预览版。页面和参考分析来自 [traumateam.cn](https://traumateam.cn/)，网站内容更新无需重新安装 APK。

- 内置骨骼、肌肉、内脏轻量模型和 Draco 资源。只有文件路径和实际内容版本完全匹配时才使用本地文件，新版本正常联网加载。
- Android 8.0（API 26）及以上，需要支持 WebGL 的 Android System WebView。首次打开需要联网。
- 只申请网络权限，外部链接交给系统打开。
- 已通过编译、Android lint、JVM 测试、签名验证、ZIP 对齐、权限及内置资源字节校验。尚未进行 Android 真机测试。

下载 `trauma-team-1.0.0.apk` 安装；`SHA256SUMS` 可核对文件，`certificate-sha256.txt` 记录今后更新应沿用的公开签名指纹。

APK SHA-256：`25397d9a71f7ee49ef628073f2eef68c084ffa896f63320bfeddcac86140d2f8`

证书 SHA-256：`6fa0cf306e3aa8662678f0d217845b97df449204493c5850ccf9b34cebd55a50`

构建源码：[`b317f65`](https://github.com/ChenlizheMe/trauma-team-international/commit/b317f650dd5aae8fa2d1c3d1ad1b9c49a2acb9dc)。模型和 Draco 的来源、许可及本地修改说明随 APK 保留。
