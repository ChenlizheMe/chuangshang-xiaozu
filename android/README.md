# 创伤小组 Android 网页壳

This Android application opens **https://traumateam.cn/** in the device's Android System WebView. The APK does **not** contain a snapshot of the website, `dist`, HTML, a service worker, clinical rules, or app JavaScript. A normal online reopen/reload obtains the current website; an already open assessment is not forcibly discarded when the app returns from the background. The site's existing service worker manages its own complete offline cache.

## What is inside the APK

- Application ID: `cn.traumateam.app`
- Version: `1.0.0`, version code `1`
- Minimum Android: 8.0 / API 26; compile and target SDK: 35
- One Android permission: `INTERNET`. No microphone, camera, location, storage, contacts, notifications, or native JavaScript bridge.
- Three existing mobile GLBs (skeleton, muscle, organs) and three Draco decoder resources: currently **3,940,293 bytes** before APK/container overhead. Existing anatomy `LICENSE` and `NOTICE`, plus Draco license/attribution, travel with them.
- No analytics, additional medical-data backend, or credential storage is added by this wrapper. The website's own privacy behavior still applies. Android app backup and device transfer are disabled for app data.

## Content-addressed local acceleration

`node android/scripts/prepare-assets.mjs` reads an explicit six-file allowlist from `public`, hashes the actual bytes, and writes build-only Android assets plus an inventory. The website independently generates its online asset manifest, emits physical content-addressed files, and makes requests such as:

`https://traumateam.cn/anatomy/skeleton-mobile.<64-lowercase-hex>.glb?v=5&sha256=<64-lowercase-hex>`

Both `WebViewClient` and `ServiceWorkerClient` use the same read-only interceptor. APK bytes are returned only for GET subresource requests with:

1. Exact HTTPS origin `traumateam.cn` (default port or 443), no user information.
2. An exact allowlisted, unencoded content-hashed filename. Logical legacy paths are never served by the APK.
3. Exactly one `sha256` equal to the bundled resource's actual SHA-256. An optional single simple `v` is allowed; unknown or duplicate parameters and fragments are not.
4. No Range header; those requests retain normal network behavior.

A lazy runtime digest also checks the packaged bytes before first use. A new website hash/path, missing hash, unmatched bytes, or malformed request falls through to ordinary HTTPS. The APK therefore cannot substitute an old model for a new content-addressed request. The website service worker keys resources by the complete URL; a cached response can bypass native interception, but a new hash has a different cache key. Missing/native-manifest failures degrade to normal network loading. No online manifest is trusted to rewrite filesystem paths or supply executable native code.

Website HTML, application code, asset selection, and rules remain online. Local model resources do not make first launch fully offline. The app supports manual retry for network/TLS/renderer failures; TLS errors are cancelled without bypass. Hardware acceleration, safe-area/keyboard insets, app pause/resume, and the site's `#/about` Back history are handled by the shell. External user-tapped HTTPS links (including `target=_blank`) open through the system; unknown/custom schemes and non-user external redirects do not get intent privileges. There are no incoming deep-link intents.

## Reproducible build inputs

Use JDK 17, Gradle 8.11.1, Android SDK platform 35 and Build Tools 35.0.0, Node 24, and the checked-in AGP 8.9.2. No Kotlin/AndroidX/native library dependency is required. The Gradle version is explicit in the official Gradle setup action rather than a downloaded wrapper binary in this repository.

```
node --test android/scripts/*.test.mjs
cd android
gradle --no-daemon lintRelease testReleaseUnitTest assembleRelease
```

`ANDROID_HOME` must name an already installed, licensed SDK. `android.builder.sdkDownload=false` prevents the build from silently installing missing SDK packages. This repository does not run `sdkmanager --licenses` or create a signing credential.

`.github/workflows/android-apk.yml` uses the preinstalled SDK on the official `ubuntu-24.04` image, runs source/packaging tests, Android lint and JVM policy tests, verifies application metadata/permissions, checks ZIP alignment, and uploads an **unsigned** release APK with SHA-256 and the source commit as an Actions build artifact. Its GitHub token has `contents: read` only. An unsigned APK is a build output, **not an installable public release**.

## Signing and release gate

Android installation and updates require signing. A public release must use an owner-controlled, long-lived signing key, with a secure private backup. Reusing the same certificate and increasing `versionCode` are essential for in-place APK updates. Losing/changing the key generally prevents updates to an existing installation.

No keystore, password, debug signing key, or signing secret is checked in, generated for release, or uploaded by this workflow. Before publishing:

1. Sign with the approved existing release key in an authorized environment. Never use a disposable CI debug key as the release identity.
2. Verify using `apksigner verify --verbose --print-certs` and `zipalign -c -P 16 4`.
3. Record the signed APK's SHA-256, signing certificate SHA-256, source commit, package/version, and device-validation limits.
4. Upload only the signed APK, its checksum, public certificate fingerprint, release notes, and any requested attribution. Never publish the private key or password.

Signing-key creation, private backup/handoff, repository secrets, and any write-enabled automated release job require explicit owner authorization. Future website updates need no APK/signature change; changing the native wrapper or bundled assets needs a new signed version.

## Publishing the reviewed preview without sending a private key to CI

The fixed first-preview job reconstructs the already signed APK from the verified unsigned Actions artifact and public APK signing-block data in `releases/1.0.0`. This data is already part of the distributable APK and cannot sign changed application bytes. The job verifies the unsigned and signed SHA-256 values, the certificate fingerprint, official `apksigner` verification, alignment, metadata and bundled bytes before publishing a prerelease. Only the publication job has `contents: write` and `actions: read`; it has no signing key or repository secrets. It accepts no arbitrary URL, script, or pull-request input. A matching existing release is verified without replacement; conflicting or incomplete assets are rejected. Keep the private release identity under the owner's control for future native updates.

## Validation checklist and honest limits

Automated CI verifies compilation, lint, URL/hash boundaries, exact packaged assets, permissions, non-debuggable status, and unsigned archive alignment. These do not prove behavior on a real Android device. Before describing a release as device-tested, actually check:

- First online launch and initial offline failure/retry.
- Skeleton, muscle, organs and Draco before/after the website service worker takes control; expected `X-Trauma-Asset-Source: apk-sha256` for native hits.
- Same path with a changed hash returns network bytes, including when the old hash remains in service-worker cache.
- About Back navigation, browser external links and return, repeated retry, TLS errors, short/rotated viewports, keyboard and background/foreground.
- Renderer termination recovery, an unavailable/outdated WebView provider, WebGL failure, and a signed in-place upgrade using the same certificate.

Android System WebView/Chrome version and GPU support affect WebGL, independently of the minimum Android API. This project is not a medical device or a replacement for professional care; the website's safety messaging and third-party attribution remain authoritative.

## Official references

- [Android WebView integration and navigation](https://developer.android.com/develop/ui/views/layout/webapps/webview)
- [Unsafe URI loading](https://developer.android.com/privacy-and-security/risks/unsafe-uri-loading)
- [WebViewClient callbacks and TLS rules](https://developer.android.com/reference/android/webkit/WebViewClient)
- [ServiceWorkerClient interception](https://developer.android.com/reference/android/webkit/ServiceWorkerClient)
- [AGP 8.9 compatibility](https://developer.android.com/build/releases/agp-8-9-0-release-notes)
- [App signing and update identity](https://developer.android.com/studio/publish/app-signing)
