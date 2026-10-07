package cn.traumateam.app;

import java.net.URI;
import java.net.URISyntaxException;

/** Pure Java policy: never infer trust from a URL prefix or suffix. */
final class UrlPolicy {
    static final String HOME = "https://traumateam.cn/";
    private UrlPolicy() { }

    static boolean isHttps(String value) {
        URI uri = parse(value);
        return uri != null && "https".equalsIgnoreCase(uri.getScheme())
                && uri.getHost() != null && uri.getRawUserInfo() == null
                && (uri.getPort() == -1 || uri.getPort() > 0);
    }

    static boolean isTrusted(String value) {
        URI uri = parse(value);
        return isHttps(value) && uri != null
                && "traumateam.cn".equalsIgnoreCase(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    static URI parse(String value) {
        try { return value == null ? null : new URI(value); }
        catch (URISyntaxException | IllegalArgumentException ignored) { return null; }
    }

    /** Only a content-addressed, exact resource may be replaced by APK bytes. */
    static boolean hasAssetHash(String value, String exactPath, String expectedHash) {
        if (!isTrusted(value)) return false;
        URI uri = parse(value);
        if (uri == null || !exactPath.equals(uri.getRawPath()) || uri.getRawFragment() != null)
            return false;
        String query = uri.getRawQuery();
        if (query == null) return false;
        boolean hashFound = false, versionFound = false;
        for (String parameter : query.split("&", -1)) {
            if (parameter.equals("sha256=" + expectedHash) && !hashFound) hashFound = true;
            else if (parameter.matches("v=[A-Za-z0-9._-]{1,80}") && !versionFound) versionFound = true;
            else return false;
        }
        return hashFound;
    }
}
