package cn.traumateam.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class MainActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<WebView> popupViews = new ArrayList<>();
    private FrameLayout root;
    private WebView webView;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private TextView errorDetail;
    private BundledAssets bundledAssets;
    private boolean loadFailed;
    private String retryUrl = UrlPolicy.HOME;
    private OnBackInvokedCallback backCallback;
    private final Runnable loadTimeout = () -> showError(R.string.load_error_detail);

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(23, 25, 22));
        setContentView(root);
        configureInsets();
        bundledAssets = new BundledAssets(getApplicationContext().getAssets());
        buildErrorPanel();
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setContentDescription(getString(R.string.loading));
        root.addView(progress, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP));
        try { configureServiceWorkers(bundledAssets); }
        catch (RuntimeException unavailable) { showError(R.string.renderer_error); }
        createWebView();
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = this::goBackOrFinish;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
        // Restore only the public route. Never serialize form or assessment data.
        String initial = state != null && state.getBoolean("about") ? UrlPolicy.HOME + "#/about" : UrlPolicy.HOME;
        loadTrusted(initial);
    }

    private void configureInsets() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            });
            root.requestApplyInsets();
        } else { root.setFitsSystemWindows(true); }
    }

    private static void configureServiceWorkers(BundledAssets assets) {
        ServiceWorkerController controller = ServiceWorkerController.getInstance();
        controller.getServiceWorkerWebSettings().setAllowContentAccess(false);
        controller.getServiceWorkerWebSettings().setAllowFileAccess(false);
        controller.getServiceWorkerWebSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
        controller.setServiceWorkerClient(new ServiceWorkerClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                return assets.intercept(request);
            }
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        try {
            WebView view = new WebView(this);
            webView = view;
            view.setBackgroundColor(Color.rgb(23, 25, 22));
            WebView.setWebContentsDebuggingEnabled(false);
            WebSettings settings = view.getSettings();
            // The site's React/WebGL runtime needs JS. No native JS interface exists.
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setAllowContentAccess(false);
            settings.setAllowFileAccess(false);
            settings.setAllowFileAccessFromFileURLs(false);
            settings.setAllowUniversalAccessFromFileURLs(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            settings.setSafeBrowsingEnabled(true);
            settings.setGeolocationEnabled(false);
            settings.setJavaScriptCanOpenWindowsAutomatically(false);
            settings.setSupportMultipleWindows(true);
            settings.setMediaPlaybackRequiresUserGesture(true);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setUserAgentString(settings.getUserAgentString() + " TraumaTeamAndroid/1.0.0");
            CookieManager.getInstance().setAcceptThirdPartyCookies(view, false);
            view.setWebViewClient(new SiteClient());
            view.setWebChromeClient(new SiteChromeClient());
            root.addView(view, 0, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        } catch (RuntimeException unavailable) {
            webView = null;
            showError(R.string.renderer_error);
        }
    }

    private void buildErrorPanel() {
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(28), dp(24), dp(28), dp(24));
        errorPanel.setBackgroundColor(Color.rgb(23, 25, 22));
        TextView title = new TextView(this);
        title.setText(R.string.load_error);
        title.setTextColor(Color.rgb(240, 231, 207));
        title.setTextSize(23);
        errorPanel.addView(title);
        errorDetail = new TextView(this);
        errorDetail.setTextColor(Color.rgb(212, 201, 157));
        errorDetail.setTextSize(16);
        errorDetail.setGravity(Gravity.CENTER);
        errorDetail.setPadding(0, dp(18), 0, dp(24));
        errorPanel.addView(errorDetail);
        Button retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setOnClickListener(ignored -> {
            // A fresh instance isolates callbacks from an interrupted same-URL retry.
            WebView previous = webView;
            webView = null;
            if (previous != null) { previous.stopLoading(); root.removeView(previous); previous.destroy(); }
            try { configureServiceWorkers(bundledAssets); }
            catch (RuntimeException unavailable) { showError(R.string.renderer_error); }
            createWebView();
            loadTrusted(retryUrl);
        });
        errorPanel.addView(retry);
        Button browser = new Button(this);
        browser.setText(R.string.open_browser);
        browser.setOnClickListener(ignored -> openBrowser(UrlPolicy.HOME));
        errorPanel.addView(browser);
        root.addView(errorPanel, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        errorPanel.setVisibility(View.GONE);
    }

    private void loadTrusted(String url) {
        if (!UrlPolicy.isTrusted(url)) url = UrlPolicy.HOME;
        retryUrl = url;
        if (webView == null) { showError(R.string.renderer_error); return; }
        beginLoading();
        // Revalidate HTML without throwing away cached, content-hashed 3D assets.
        webView.loadUrl(url, Collections.singletonMap("Cache-Control", "no-cache"));
    }

    private void beginLoading() {
        loadFailed = false;
        errorPanel.setVisibility(View.GONE);
        progress.setVisibility(View.VISIBLE);
        progress.setProgress(0);
        handler.removeCallbacks(loadTimeout);
        handler.postDelayed(loadTimeout, 45000);
    }

    private void showError(int message) {
        if (isFinishing() || isDestroyed()) return;
        loadFailed = true;
        handler.removeCallbacks(loadTimeout);
        if (progress != null) progress.setVisibility(View.GONE);
        errorDetail.setText(message);
        errorPanel.setVisibility(View.VISIBLE);
        errorPanel.bringToFront();
    }

    private void openBrowser(String url) {
        if (!UrlPolicy.isHttps(url)) { Toast.makeText(this, R.string.link_blocked, Toast.LENGTH_SHORT).show(); return; }
        try {
            // Never parse website text as an Intent or pass through its extras.
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(intent);
        } catch (ActivityNotFoundException | SecurityException missing) {
            Toast.makeText(this, R.string.no_browser, Toast.LENGTH_LONG).show();
        }
    }

    private void goBackOrFinish() {
        if (webView != null && !loadFailed && webView.canGoBack()) { webView.goBack(); return; }
        if (webView != null && webView.getUrl() != null && webView.getUrl().endsWith("#/about")) {
            loadTrusted(UrlPolicy.HOME); return;
        }
        finish();
    }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() { goBackOrFinish(); }

    @Override protected void onSaveInstanceState(Bundle out) {
        out.putBoolean("about", webView != null && webView.getUrl() != null && webView.getUrl().endsWith("#/about"));
        super.onSaveInstanceState(out);
    }

    @Override protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null)
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        for (WebView popup : new ArrayList<>(popupViews)) destroyPopup(popup);
        if (webView != null) { root.removeView(webView); webView.destroy(); webView = null; }
        super.onDestroy();
    }

    private void destroyPopup(WebView popup) {
        if (popupViews.remove(popup)) popup.destroy();
    }

    private static WebResourceResponse blockedNavigation() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked",
                Collections.singletonMap("Cache-Control", "no-store"), new ByteArrayInputStream(new byte[0]));
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private final class SiteClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            if (UrlPolicy.isTrusted(url)) return false;
            if (request.isForMainFrame() && request.hasGesture() && UrlPolicy.isHttps(url)) openBrowser(url);
            return true;
        }

        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (request.isForMainFrame() && !UrlPolicy.isTrusted(request.getUrl().toString())) return blockedNavigation();
            return bundledAssets.intercept(request);
        }

        @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
            if (view != webView) return;
            if (!UrlPolicy.isTrusted(url)) { view.stopLoading(); showError(R.string.secure_error); return; }
            retryUrl = url;
            beginLoading();
        }

        @Override public void onPageFinished(WebView view, String url) {
            if (view != webView || url == null || !url.equals(view.getUrl())) return;
            handler.removeCallbacks(loadTimeout);
            if (!loadFailed) { progress.setVisibility(View.GONE); errorPanel.setVisibility(View.GONE); }
        }

        @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (view == webView && request.isForMainFrame()
                    && request.getUrl().toString().equals(retryUrl)) showError(R.string.load_error_detail);
        }

        @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (view == webView && request.isForMainFrame()
                    && request.getUrl().toString().equals(retryUrl)) showError(R.string.load_error_detail);
        }

        @Override public void onReceivedSslError(WebView view, SslErrorHandler ssl, SslError error) {
            ssl.cancel();
            // Never offer a bypass, including for subresource certificate errors.
            if (view == webView) showError(R.string.secure_error);
        }

        @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            root.removeView(view);
            view.destroy();
            if (webView == view) { webView = null; showError(R.string.renderer_error); }
            return true;
        }
    }

    private final class SiteChromeClient extends WebChromeClient {
        @Override public void onProgressChanged(WebView view, int value) {
            if (view == webView && !loadFailed) progress.setProgress(value);
        }

        @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }

        @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean userGesture, Message message) {
            if (!userGesture || !UrlPolicy.isTrusted(view.getUrl())) return false;
            // target=_blank must not render an arbitrary site in a privileged WebView.
            // The transport is inert: no JS, files, content providers, or network loads.
            WebView popup = new WebView(MainActivity.this);
            popup.getSettings().setJavaScriptEnabled(false);
            popup.getSettings().setAllowFileAccess(false);
            popup.getSettings().setAllowContentAccess(false);
            popup.getSettings().setBlockNetworkLoads(true);
            popupViews.add(popup);
            popup.setWebViewClient(new WebViewClient() {
                private boolean handled;
                @Override public boolean shouldOverrideUrlLoading(WebView target, WebResourceRequest request) {
                    if (!handled && request.isForMainFrame()) {
                        handled = true;
                        String url = request.getUrl().toString();
                        if (UrlPolicy.isTrusted(url)) loadTrusted(url); else openBrowser(url);
                        handler.post(() -> destroyPopup(popup));
                    }
                    return true;
                }
                @Override public WebResourceResponse shouldInterceptRequest(WebView target, WebResourceRequest request) {
                    return blockedNavigation();
                }
                @Override public boolean onRenderProcessGone(WebView target, RenderProcessGoneDetail detail) {
                    destroyPopup(target);
                    return true;
                }
            });
            ((WebView.WebViewTransport) message.obj).setWebView(popup);
            message.sendToTarget();
            handler.postDelayed(() -> destroyPopup(popup), 5000);
            return true;
        }
    }
}
