package com.nextuprobotics.hub;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * The Nextup company hub on a phone: the dashboard's screens (built into assets/www by
 * `npm run android`) in a WebView. They are served from https://appassets.androidplatform.net,
 * a name reserved for exactly this, so the page is a normal secure https page. The hub address
 * is built into those screens and is never shown. Links to anything else (phone numbers, email,
 * WhatsApp, websites) open in the phone's own apps.
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/index.html";
    static final String EXTRA_NOTIFICATION = "nx_notification";
    static final int PICK_FILE = 1;
    static final int ASK_NOTIFICATIONS = 2;

    WebView web;
    Bridge bridge;
    private ValueCallback<Uri[]> filePick;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false); // target="_blank" links come to shouldOverrideUrlLoading
        s.setUserAgentString(s.getUserAgentString() + " NextupHubApp/" + BridgeInfo.version(this));

        bridge = new Bridge(this);
        web.addJavascriptInterface(bridge, "NextupApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!"https".equals(u.getScheme()) || !HOST.equals(u.getHost())) return null; // the hub, fonts: normal network
                return asset(u.getPath());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) return false;
                openOutside(u);
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePick != null) filePick.onReceiveValue(null);
                filePick = callback;
                Intent pick = params.createIntent();
                pick.setType("*/*"); // CSV files are often labelled oddly by phones: let every file be picked
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                try {
                    startActivityForResult(Intent.createChooser(pick, "Choose a file"), PICK_FILE);
                    return true;
                } catch (ActivityNotFoundException e) {
                    filePick = null;
                    Toast.makeText(MainActivity.this, "No app on this phone can pick files", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        if (saved != null) web.restoreState(saved);
        if (web.getUrl() == null) web.loadUrl(START);
        fromNotification(getIntent());
    }

    /** Files of the built dashboard, from assets/www. */
    WebResourceResponse asset(String path) {
        if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
        if (path.contains("..")) return notFound();
        String file = "www" + path;
        try {
            InputStream in = getAssets().open(file);
            String mime = mimeOf(file);
            WebResourceResponse r = new WebResourceResponse(mime, mime.startsWith("text/") || mime.endsWith("javascript") || mime.endsWith("json") || mime.endsWith("svg+xml") ? "utf-8" : null, in);
            Map<String, String> h = new HashMap<>();
            h.put("Cache-Control", "no-cache");
            r.setResponseHeaders(h);
            return r;
        } catch (IOException e) {
            return notFound();
        }
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    static String mimeOf(String name) {
        String n = name.toLowerCase();
        if (n.endsWith(".html")) return "text/html";
        if (n.endsWith(".js") || n.endsWith(".mjs")) return "text/javascript";
        if (n.endsWith(".css")) return "text/css";
        if (n.endsWith(".svg")) return "image/svg+xml";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        if (n.endsWith(".webp")) return "image/webp";
        if (n.endsWith(".ico")) return "image/x-icon";
        if (n.endsWith(".json")) return "application/json";
        if (n.endsWith(".woff2")) return "font/woff2";
        if (n.endsWith(".woff")) return "font/woff";
        if (n.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    void openOutside(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
        // Only ordinary links: never intent:// or file:// from a page.
        if (!(scheme.equals("https") || scheme.equals("http") || scheme.equals("tel") || scheme.equals("mailto") || scheme.equals("sms") || scheme.equals("whatsapp"))) return;
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, u);
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No app on this phone can open this link", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        if (request == PICK_FILE && filePick != null) {
            Uri[] picked = null;
            if (result == RESULT_OK && data != null && data.getData() != null) picked = new Uri[]{data.getData()};
            filePick.onReceiveValue(picked);
            filePick = null;
            return;
        }
        super.onActivityResult(request, result, data);
    }

    @Override
    public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        if (request == ASK_NOTIFICATIONS) bridge.permissionAnswered();
        else super.onRequestPermissionsResult(request, permissions, results);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        fromNotification(intent);
    }

    /** A tapped notification opens what it is about. */
    private void fromNotification(Intent intent) {
        if (intent == null || !intent.hasExtra(EXTRA_NOTIFICATION)) return;
        int id = intent.getIntExtra(EXTRA_NOTIFICATION, 0);
        intent.removeExtra(EXTRA_NOTIFICATION);
        js("window.__nxNotificationClick && window.__nxNotificationClick(" + id + ")");
    }

    void js(final String code) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() { if (web != null) web.evaluateJavascript(code, null); }
        });
    }

    // The WebView is not paused in the background, so live updates (and notifications) keep coming
    // until Android stops the app. The page is told it is hidden, as a browser tab would be.
    @Override
    protected void onStart() {
        super.onStart();
        js("window.__nxSetBackground && window.__nxSetBackground(false)");
    }

    @Override
    protected void onStop() {
        js("window.__nxSetBackground && window.__nxSetBackground(true)");
        super.onStop();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** Small helpers that do not need an Activity. */
    static final class BridgeInfo {
        static String version(Activity a) {
            try {
                return a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "1";
            }
        }
    }

    static boolean atLeast(int sdk) { return Build.VERSION.SDK_INT >= sdk; }
}
