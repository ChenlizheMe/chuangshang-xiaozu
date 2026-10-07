package cn.traumateam.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class UrlPolicyTest {
    private static final String HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    private static final String PATH = "/anatomy/skeleton-mobile." + HASH + ".glb";
    private static final String ASSET = "https://traumateam.cn" + PATH;

    @Test public void trustedOriginIsExact() {
        for (String url : new String[]{UrlPolicy.HOME, "https://traumateam.cn/#/about", "https://traumateam.cn:443/a", "https://TRAUMATEAM.CN/"})
            assertTrue(url, UrlPolicy.isTrusted(url));
        for (String url : new String[]{"http://traumateam.cn", "https://traumateam.cn.evil.test", "https://eviltraumateam.cn", "https://www.traumateam.cn", "https://traumateam.cn:8443", "https://user@traumateam.cn", "https://traumateam.cn@evil.test", "https://traumateam.cn.", "https://traumateam.cn\\@evil.test", "//traumateam.cn", "javascript:alert(1)", "data:text/html,test", "file:///a", "content://a", "intent://a", "https://%74raumateam.cn", "", null})
            assertFalse(String.valueOf(url), UrlPolicy.isTrusted(url));
    }

    @Test public void onlySafeHttpsCanLeaveForBrowser() {
        assertTrue(UrlPolicy.isHttps("https://github.com/ChenlizheMe"));
        assertTrue(UrlPolicy.isHttps("https://example.org/page?q=value"));
        for (String url : new String[]{"http://example.org", "intent://example.org", "mailto:a@b.com", "https://user:password@example.org", "https:///page", "https://example.org:0", null})
            assertFalse(String.valueOf(url), UrlPolicy.isHttps(url));
    }

    @Test public void matchingContentAddressCanUseApkBytes() {
        for (String query : new String[]{"sha256=" + HASH, "v=5&sha256=" + HASH, "sha256=" + HASH + "&v=6"})
            assertTrue(query, UrlPolicy.hasAssetHash(ASSET + "?" + query, PATH, HASH));
    }

    @Test public void missingWrongDuplicateOrUnknownParameterFallsBackToNetwork() {
        for (String suffix : new String[]{"", "?v=5", "?sha256=wrong", "?sha256=" + HASH.toUpperCase(), "?sha256=" + HASH + "&sha256=" + HASH,
                "?v=5&v=5&sha256=" + HASH, "?sha256=" + HASH + "&download=1", "?sha256=" + HASH + "&", "?SHA256=" + HASH,
                "?sha256=" + HASH + "#fragment", "?sha256=" + HASH + "&v=%35", "?sha256=" + HASH + "&v="})
            assertFalse(suffix, UrlPolicy.hasAssetHash(ASSET + suffix, PATH, HASH));
    }

    @Test public void aliasesTraversalAndForeignOriginsNeverUseApkBytes() {
        for (String prefix : new String[]{"https://traumateam.cn/anatomy/%73keleton-mobile." + HASH + ".glb", "https://traumateam.cn/anatomy/x/../skeleton-mobile." + HASH + ".glb",
                "https://traumateam.cn/anatomy/%2e%2e/anatomy/skeleton-mobile." + HASH + ".glb", "https://traumateam.cn/anatomy%2fskeleton-mobile." + HASH + ".glb",
                "https://traumateam.cn/anatomy/Skeleton-mobile." + HASH + ".glb", "https://traumateam.cn:8443" + PATH, "https://user@traumateam.cn" + PATH,
                "https://evil.test" + PATH, "http://traumateam.cn" + PATH, "https://traumateam.cn/anatomy/new.glb"})
            assertFalse(prefix, UrlPolicy.hasAssetHash(prefix + "?sha256=" + HASH, PATH, HASH));
    }
}
