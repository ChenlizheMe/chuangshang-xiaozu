package cn.traumateam.app;

import android.content.res.AssetManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Arrays;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Read-only, same-origin, content-addressed acceleration. No webpage is bundled. */
final class BundledAssets {
    private static final Set<String> ALLOWED = new HashSet<>(Arrays.asList(
            "/anatomy/skeleton-mobile.glb", "/anatomy/muscle-mobile.glb",
            "/anatomy/organs-mobile.glb", "/draco/draco_decoder.js",
            "/draco/draco_wasm_wrapper.js", "/draco/draco_decoder.wasm"));
    private final AssetManager assets;
    private final Map<String, Entry> entries = new HashMap<>();
    private final Set<String> verified = ConcurrentHashMap.newKeySet();

    BundledAssets(AssetManager assets) {
        this.assets = assets;
        Properties manifest = new Properties();
        try (InputStream input = assets.open("packaged-assets.properties")) {
            manifest.load(input);
            for (String path : manifest.stringPropertyNames()) {
                String[] fields = manifest.getProperty(path, "").split("\\|", -1);
                if (fields.length != 4 || !fields[0].matches("[0-9a-f]{64}")
                        || !ALLOWED.contains("/" + fields[3])) continue;
                String logicalPath = "/" + fields[3];
                int extension = logicalPath.lastIndexOf('.');
                String exactVersionedPath = logicalPath.substring(0, extension) + "." + fields[0] + logicalPath.substring(extension);
                if (!path.equals(exactVersionedPath)) continue;
                long size = Long.parseLong(fields[2]);
                if (size <= 0 || size > 16 * 1024 * 1024) continue;
                String mime = path.endsWith(".glb") ? "model/gltf-binary"
                        : path.endsWith(".wasm") ? "application/wasm" : "text/javascript";
                if (mime.equals(fields[1])) entries.put(path, new Entry(fields[0], mime, size, fields[3]));
            }
        } catch (IOException | NumberFormatException ignored) {
            // Invalid or absent optimization data must fall back to normal HTTPS.
            entries.clear();
        }
    }

    WebResourceResponse intercept(WebResourceRequest request) {
        if (!"GET".equals(request.getMethod()) || request.isForMainFrame()) return null;
        for (String header : request.getRequestHeaders().keySet())
            if ("Range".equalsIgnoreCase(header)) return null;
        String url = request.getUrl().toString();
        URI uri = UrlPolicy.parse(url);
        if (uri == null) return null;
        Entry entry = entries.get(uri.getRawPath());
        if (entry == null || !UrlPolicy.hasAssetHash(url, uri.getRawPath(), entry.hash)) return null;
        try {
            if (!verified.contains(entry.file)) {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long size = 0;
                try (InputStream input = assets.open(entry.file)) {
                    byte[] bytes = new byte[8192];
                    int length;
                    while ((length = input.read(bytes)) != -1) { digest.update(bytes, 0, length); size += length; }
                }
                StringBuilder actual = new StringBuilder();
                for (byte value : digest.digest()) actual.append(String.format(java.util.Locale.ROOT, "%02x", value & 0xff));
                if (size != entry.size || !entry.hash.contentEquals(actual)) return null;
                verified.add(entry.file);
            }
            Map<String, String> headers = new HashMap<>();
            headers.put("Content-Length", Long.toString(entry.size));
            headers.put("Cache-Control", "public, max-age=31536000, immutable");
            headers.put("ETag", "\"" + entry.hash + "\"");
            headers.put("X-Content-Type-Options", "nosniff");
            headers.put("X-Trauma-Asset-Source", "apk-sha256");
            return new WebResourceResponse(entry.mime, entry.mime.equals("text/javascript") ? "UTF-8" : null,
                    200, "OK", headers, assets.open(entry.file));
        } catch (IOException | NoSuchAlgorithmException ignored) { return null; }
    }

    private static final class Entry {
        final String hash, mime, file;
        final long size;
        Entry(String hash, String mime, long size, String file) {
            this.hash = hash; this.mime = mime; this.size = size; this.file = file;
        }
    }
}
