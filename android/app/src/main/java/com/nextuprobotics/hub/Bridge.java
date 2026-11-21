package com.nextuprobotics.hub;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * What the dashboard can ask of the phone (window.NextupApp in src/native.js): save a file,
 * show a notification, colour the status bar. Only the app's own screens are ever loaded, and
 * nothing here reads data from the phone.
 */
public class Bridge {
    static final String CHANNEL = "alerts";
    private final MainActivity a;
    private final SharedPreferences prefs;

    Bridge(MainActivity activity) {
        a = activity;
        prefs = activity.getSharedPreferences("nx", Context.MODE_PRIVATE);
    }

    // ---- Files (CSV exports, import templates) ----

    @JavascriptInterface
    public void saveFile(String name, String mime, String base64) {
        final String clean = cleanName(name);
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, clean);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                ContentResolver cr = a.getContentResolver();
                Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new IllegalStateException("no uri");
                try (OutputStream out = cr.openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("no stream");
                    out.write(bytes);
                }
                toast("Saved to Downloads: " + clean);
            } else {
                // Android 9 and older: offer it to another app (Drive, email, WhatsApp, Files…).
                File dir = new File(a.getCacheDir(), "shared");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new IllegalStateException("no dir");
                File f = new File(dir, clean);
                try (FileOutputStream out = new FileOutputStream(f)) { out.write(bytes); }
                Uri uri = Uri.parse("content://" + FilesProvider.AUTHORITY + "/" + Uri.encode(clean));
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mime);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.setClipData(ClipData.newRawUri(clean, uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                a.startActivity(Intent.createChooser(send, clean));
            }
        } catch (Exception e) {
            toast("Could not save " + clean);
        }
    }

    static String cleanName(String name) {
        String n = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\x00-\\x1f]", "_").trim();
        if (n.isEmpty() || n.startsWith(".")) n = "nextup-file" + n;
        return n.length() > 120 ? n.substring(n.length() - 120) : n;
    }

    // ---- Notifications ----

    @JavascriptInterface
    public String notificationPermission() {
        NotificationManager nm = (NotificationManager) a.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 33) {
            if (a.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                return nm.areNotificationsEnabled() ? "granted" : "denied";
            }
            // Asked before and Android will not ask again: blocked until changed in Settings.
            boolean asked = prefs.getBoolean("askedNotifications", false);
            return asked && !a.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) ? "denied" : "default";
        }
        return nm.areNotificationsEnabled() ? "granted" : "denied";
    }

    @JavascriptInterface
    public void requestNotificationPermission() {
        a.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (Build.VERSION.SDK_INT >= 33 && "default".equals(notificationPermission())) {
                    a.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, MainActivity.ASK_NOTIFICATIONS);
                } else {
                    permissionAnswered();
                }
            }
        });
    }

    void permissionAnswered() {
        prefs.edit().putBoolean("askedNotifications", true).apply();
        a.js("window.__nxPermission && window.__nxPermission('" + notificationPermission() + "')");
    }

    @JavascriptInterface
    public void notify(int id, String title, String body) {
        if (!"granted".equals(notificationPermission())) return;
        NotificationManager nm = (NotificationManager) a.getSystemService(Context.NOTIFICATION_SERVICE);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            if (nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, a.getString(R.string.alerts_channel), NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("New website enquiries and bug reports");
                nm.createNotificationChannel(ch);
            }
            b = new Notification.Builder(a, CHANNEL);
        } else {
            b = new Notification.Builder(a).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        }
        Intent open = new Intent(a, MainActivity.class)
                .putExtra(MainActivity.EXTRA_NOTIFICATION, id)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(a, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        b.setSmallIcon(R.drawable.ic_stat)
                .setColor(0xFF2468D2)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(tap)
                .setAutoCancel(true);
        nm.notify(id, b.build());
    }

    @JavascriptInterface
    public void cancel(int id) {
        ((NotificationManager) a.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(id);
    }

    // ---- Status and navigation bars follow the dashboard's light / dark theme ----

    @JavascriptInterface
    public void setBars(final String color, final boolean light) {
        a.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                int c;
                try { c = Color.parseColor(color); } catch (Exception e) { return; }
                a.getWindow().setStatusBarColor(c);
                a.getWindow().setNavigationBarColor(c);
                a.getWindow().getDecorView().setBackgroundColor(c);
                if (Build.VERSION.SDK_INT >= 23) {
                    View d = a.getWindow().getDecorView();
                    int f = d.getSystemUiVisibility();
                    f = light ? (f | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR) : (f & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
                    if (Build.VERSION.SDK_INT >= 26) {
                        f = light ? (f | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR) : (f & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
                    }
                    d.setSystemUiVisibility(f);
                }
            }
        });
    }

    private void toast(final String text) {
        a.runOnUiThread(new Runnable() {
            @Override
            public void run() { Toast.makeText(a, text, Toast.LENGTH_LONG).show(); }
        });
    }
}
