package com.alix.genderwarfare;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import java.util.Map;
import java.util.Iterator;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import org.json.JSONArray;
import org.json.JSONObject;

// GENDER WARFARE Android 앱 (문플로 SAF 및 골든퀘스트 baseT 표준 이식)
// 게임 에셋은 APK 안에 포함. 로컬 우선 저장 후 Drive 파일과 동기화한다.
// 저장은 게임 쪽(localStorage)과 앱 쪽(SharedPreferences "store")에 같이 적어, 두 판이 같은 저장을 쓴다.
public final class MainActivity extends Activity {
    private static final String LOCAL = "https://appassets.androidplatform.net/assets/index.html";
    private WebView game;
    private SharedPreferences store;
    // 연결 정보는 게임 저장과 분리: 백업 파일에 기기별 Uri를 넣지 않는다.
    private SharedPreferences backupPrefs;
    private static final int REQ_BACKUP = 502, REQ_LINK = 505, MAX_BACKUP_BYTES = 8000000;
    private final ScheduledExecutorService backupIO = Executors.newSingleThreadScheduledExecutor();
    private final ExecutorService documentIO = Executors.newSingleThreadExecutor();
    private volatile boolean documentBusy = false;
    private final Object backupLock = new Object();
    private ScheduledFuture<?> pendingBackup;
    private volatile boolean restoringBackup = false, pickingBackup = false;
    private volatile String pendingRestore = null;
    private volatile boolean awaitingRestoreReload = false;
    private volatile boolean checkingRemote = false;
    private volatile boolean pageReady = false, foreground = false;
    // 첫 실행 동기화는 webReady가 한 번만 담당한다. 첫 onResume/초기 네트워크 콜백이 겹쳐 Drive를 재조회하지 않게 한다.
    private volatile boolean networkValidated = false;
    private boolean firstResume = true;
    // 이번 실행에서 드라이브 파일을 읽어 확인했는지, 파일과 맞춘 마지막 저장 시각, 동기화 중 밀린 저장 여부.
    // 저장(쓰기)은 확인이 끝난 뒤에는 읽기 없이 쓰기만 한다. 읽기는 시작·복귀·재연결 때만 한다.
    private volatile boolean sessionSynced = false, writeDirty = false;
    // 충돌(두 기기 모두 바뀜)을 사람에게 묻는 중이면 그 사이 파일에 쓰지 않는다(문플로 방식).
    private volatile boolean conflictPending = false;
    private volatile String pendingConflict = null;
    // baseT: 이 기기가 파일과 마지막으로 맞춘 저장의 t. 저장 시각끼리 겨루지 않고 이것과 비교한다.
    private long baseT() { return backupPrefs.getLong("baseT", -1); }
    private void setBaseT(long t) { backupPrefs.edit().putLong("baseT", t).apply(); }
    static final int SYNC_NONE = 0, SYNC_WRITE = 1, SYNC_APPLY = 2, SYNC_ASK = 3;
    static boolean shouldSyncOnNetworkChange(boolean wasValidated, boolean validated, boolean foreground, boolean pageReady) {
        return validated && !wasValidated && foreground && pageReady;
    }
    // lt: 이 기기 저장의 t, rt: 파일 저장의 t(없거나 깨지면 -1), bt: 마지막으로 맞춘 t(모르면 -1)
    static int decide(long lt, long rt, long bt) {
        if (rt < 0) return lt >= 0 ? SYNC_WRITE : SYNC_NONE;   // 파일이 없거나 깨짐 → 이 기기 저장으로 채움
        if (lt < 0) return SYNC_APPLY;                         // 이 기기에 저장이 없음 → 파일을 가져옴
        if (lt == rt) return SYNC_NONE;
        boolean localChanged = lt > bt, remoteChanged = rt > bt;
        if (remoteChanged && !localChanged) return SYNC_APPLY; // 다른 기기만 진행 → 자동으로 가져옴
        if (localChanged && !remoteChanged) return SYNC_WRITE; // 이 기기만 진행 → 자동으로 올림
        return SYNC_ASK;                                       // 둘 다 바뀌었거나 알 수 없음 → 물어봄
    }
    private static final int READ_WAIT_SECONDS = 15, WRITE_WAIT_SECONDS = 30;
    private ConnectivityManager connectivity;
    private ConnectivityManager.NetworkCallback networkCallback;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private boolean usingLocal = false, remoteOk = false;
    private long backAt = 0;

    private void loadLocal() { if (usingLocal) return; usingLocal = true; if (game != null) game.loadUrl(LOCAL); }

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        store = getSharedPreferences("store", MODE_PRIVATE);
        backupPrefs = getSharedPreferences("backup", MODE_PRIVATE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideBars();
        getWindow().getDecorView().setOnSystemUiVisibilityChangeListener(v -> ui.postDelayed(this::hideBars, 1500));
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);

        game = new WebView(this);
        game.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        game.setBackgroundColor(Color.rgb(28, 22, 16));
        WebSettings s = game.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        game.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return loader.shouldInterceptRequest(r.getUrl());
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, android.webkit.WebResourceError e) {
                if (r.isForMainFrame() && !usingLocal) ui.post(MainActivity.this::loadLocal);
            }
            @Override public void onReceivedHttpError(WebView v, WebResourceRequest r, WebResourceResponse e) {
                if (r.isForMainFrame() && !usingLocal) ui.post(MainActivity.this::loadLocal);
            }
            @Override public void onPageFinished(WebView v, String url) {
                if (awaitingRestoreReload) { awaitingRestoreReload = false; restoringBackup = false; }
                // 정화방은 메인 HTML과 다른 문서. 브리지를 동일하게 설치한다.
                if (url != null && url.contains("purification.html"))
                    v.evaluateJavascript("(function(){if(!window.GW_SAVE_SYNC){var s=document.createElement('script');s.src='save_sync.js';document.head.appendChild(s);}})()", null);
            }
            @Override public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
                Toast.makeText(MainActivity.this, "화면이 멈춰서 다시 시작합니다", Toast.LENGTH_LONG).show();
                recreate();
                return true;
            }
        });
        game.setWebChromeClient(new WebChromeClient());
        game.addJavascriptInterface(new Bridge(), "GWBridge");
        connectivity = (ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);
        // 앱이 이미 온라인인 상태로 시작할 때 오는 초기 capability 알림은 "재연결"이 아니다.
        networkValidated = isOnline();
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override public void onCapabilitiesChanged(Network n, NetworkCapabilities caps) {
                boolean validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
                boolean wasValidated = networkValidated;
                networkValidated = validated;
                // 실제 오프라인→온라인 전환일 때만 다시 읽는다. 시작 시 최초 읽기는 webReady가 담당한다.
                if (shouldSyncOnNetworkChange(wasValidated, validated, foreground, pageReady))
                    requestSync(true);
            }
            @Override public void onLost(Network n) { networkValidated = false; backupNotice(""); }
        };
        connectivity.registerDefaultNetworkCallback(networkCallback);
        setContentView(game);
        requestHighestRefreshRate();
        // 메인 게임/정화방 에셋 전체를 APK에 내장, 오프라인 구동.
        loadLocal();
    }

    /** 게임이 부르는 앱 기능: 저장 보관 */
    private final class Bridge {
        @JavascriptInterface public String load() {
            try { JSONObject o = new JSONObject(); for (Map.Entry<String, ?> e : store.getAll().entrySet()) o.put(e.getKey(), String.valueOf(e.getValue())); return o.toString(); }
            catch (Exception e) { return "{}"; }
        }
        @JavascriptInterface public void put(String k, String v) {
            if (k == null || !k.startsWith("gw_") || v == null) return;
            synchronized (backupLock) { if (restoringBackup) return; store.edit().putString(k, v).apply(); }
            queueBackup(false);
        }
        @JavascriptInterface public void del(String k) {
            if (k == null || !k.startsWith("gw_")) return;
            synchronized (backupLock) { if (restoringBackup) return; store.edit().remove(k).apply(); }
            queueBackup(false);
        }
        @JavascriptInterface public boolean isApp() { return true; }
        @JavascriptInterface public String reconcileLocal(String text) {
            synchronized (backupLock) {
                try {
                    JSONObject chosen = latestBackup(snapshot(), new JSONObject(text));
                    if (chosen != null && !restoringBackup) replaceStore(chosen);
                    return chosen == null ? load() : chosen.toString();
                } catch (Exception e) { return load(); }
            }
        }
        @JavascriptInterface public void syncBackup() { requestSync(true); }
        // 충돌 창에서 고른 결과. true = 파일(다른 기기) 진행으로, false = 이 기기 진행으로 파일 덮어쓰기
        @JavascriptInterface public void resolveConflict(boolean useFile) {
            final String text = pendingConflict; final Uri u = backupUri();
            if (text == null || u == null) { conflictPending = false; js("window.onGwSyncDone&&window.onGwSyncDone()"); return; }
            pendingConflict = null;
            backupIO.execute(() -> {
                boolean reload = false;
                try {
                    JSONObject remote = parseRemote(text);
                    if (useFile && remote != null) {
                        synchronized (backupLock) {
                            restoringBackup = true;
                            try { replaceStore(remote); } catch (Exception e) { restoringBackup = false; throw e; }
                            awaitingRestoreReload = true; reload = true;
                        }
                        setBaseT(saveTime(remote));
                        js("window.onGwBackupApplied&&window.onGwBackupApplied(" + JSONObject.quote(remote.toString()) + ")");
                    } else {
                        JSONObject local; synchronized (backupLock) { local = snapshot(); }
                        if (saveTime(local) < 0) throw new IllegalStateException();
                        writeDocument(u, local.toString());
                        setBaseT(saveTime(local));
                    }
                    sessionSynced = true;
                    backupPrefs.edit().putLong("backupAt", System.currentTimeMillis()).remove("error").apply();
                } catch (Exception e) {
                    backupPrefs.edit().putString("error", "동기화 대기").apply();
                } finally {
                    conflictPending = false;
                    if (!reload) js("window.onGwSyncDone&&window.onGwSyncDone()");
                    backupNotice("");
                }
            });
        }
        @JavascriptInterface public void webReady() {
            pageReady = true;
            if (awaitingRestoreReload) { awaitingRestoreReload = false; restoringBackup = false; }
            requestSync(true);
        }
        @JavascriptInterface public String backupStatus() {
            try { return new JSONObject().put("linked", backupUri() != null)
                .put("at", backupPrefs.getLong("backupAt", 0)).put("held", backupPrefs.getBoolean("held", false))
                .put("online", isOnline()).put("syncing", checkingRemote)
                .put("error", backupPrefs.getString("error", "")).toString(); }
            catch (Exception e) { return "{}"; }
        }
        @JavascriptInterface public void pickBackup() {
            runOnUiThread(() -> new AlertDialog.Builder(MainActivity.this)
                .setTitle("드라이브 백업 파일 고르기")
                .setItems(new String[]{"새 저장 파일 만들기", "기존 저장 파일 연결"}, (d, which) -> pickDocument(which == 0))
                .setNegativeButton("취소", null).show());
        }
        @JavascriptInterface public void restoreBackup() { readBackup(); }
        @JavascriptInterface public void cancelRestore() { pendingRestore = null; restoringBackup = false; }
        @JavascriptInterface public void applyBackup() {
            final String text = pendingRestore;
            if (text == null || !restoringBackup) return;
            pendingRestore = null;
            backupIO.execute(() -> {
                try {
                    JSONObject all = validBackup(text);
                    synchronized (backupLock) { replaceStore(all); }
                    backupPrefs.edit().putBoolean("held", false).putBoolean("linkPending", false).remove("error").apply();
                    awaitingRestoreReload = true;
                    js("window.onGwBackupApplied&&window.onGwBackupApplied(" + JSONObject.quote(text) + ")");
                } catch (Exception e) { restoringBackup = false; js("window.onGwBackupFail&&window.onGwBackupFail('기기 저장을 갱신하지 못했습니다.')"); }
            });
        }
    }

    private void js(String code) { ui.post(() -> { if (game != null) game.evaluateJavascript(code, null); }); }
    private void backupNotice(String message) { js("window.onGwBackup&&window.onGwBackup(" + JSONObject.quote(message) + ")"); }
    private Uri backupUri() { String u = backupPrefs.getString("uri", null); return u == null ? null : Uri.parse(u); }
    private boolean isOnline() {
        if (connectivity == null) return false;
        NetworkCapabilities caps = connectivity.getNetworkCapabilities(connectivity.getActiveNetwork());
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }
    private void replaceStore(JSONObject all) throws Exception {
        SharedPreferences.Editor edit = store.edit();
        for (String k : store.getAll().keySet()) if (k.startsWith("gw_")) edit.remove(k);
        for (Iterator<String> it = all.keys(); it.hasNext();) { String k = it.next(); edit.putString(k, all.getString(k)); }
        if (!edit.commit()) throw new IllegalStateException();
    }

    // 문플로와 같은 Storage Access Framework: 구글 로그인/API 키 없이 드라이브의 파일을 지정한다.
    private void pickDocument(boolean create) {
        pickingBackup = true;
        Intent i = new Intent(create ? Intent.ACTION_CREATE_DOCUMENT : Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(create ? "application/json" : "*/*");
        if (create) i.putExtra(Intent.EXTRA_TITLE, "gender_warfare_save.json");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        try { startActivityForResult(i, create ? REQ_BACKUP : REQ_LINK); }
        catch (ActivityNotFoundException e) { pickingBackup = false; backupNotice("파일 선택 화면을 열지 못했습니다."); }
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_BACKUP && req != REQ_LINK) return;
        pickingBackup = false;
        if (res != RESULT_OK || data == null || data.getData() == null) { backupNotice("파일 선택을 취소했습니다."); return; }
        Uri u = data.getData();
        try {
            int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            if (flags != (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION)) throw new IllegalStateException();
            getContentResolver().takePersistableUriPermission(u, flags);
            backupPrefs.edit().putString("uri", u.toString()).putLong("backupAt", 0).putLong("baseT", -1)
                .putBoolean("held", false).putBoolean("linkPending", false)
                .putBoolean("newFile", req == REQ_BACKUP).remove("error").apply();
            requestSync(true);
            backupNotice("연결했습니다. 동기화 상태를 비교합니다.");
        } catch (Exception e) { backupNotice("읽기·쓰기 권한을 유지할 수 없습니다. 파일을 다시 골라 주세요."); }
    }

    private void queueBackup(boolean force) {
        synchronized (backupLock) {
            if (backupUri() == null || restoringBackup || pickingBackup) return;
            if (checkingRemote) { writeDirty = true; return; } // 동기화·쓰기 중 생긴 저장은 끝난 뒤 한 번 다시 올린다
            if (pendingBackup != null && !pendingBackup.isDone()) {
                if (!force) return;
                pendingBackup.cancel(false);
            }
            pendingBackup = backupIO.schedule(() -> {
                synchronized (backupLock) { pendingBackup = null; }
                writeBackup();
            }, force ? 0 : 5, TimeUnit.SECONDS);
        }
    }

    private JSONObject snapshot() throws Exception {
        JSONObject o = new JSONObject();
        for (Map.Entry<String, ?> e : store.getAll().entrySet())
            if (e.getKey().startsWith("gw_") && e.getValue() instanceof String) o.put(e.getKey(), e.getValue());
        return o;
    }

    // 백업 형식은 기존 gw_* 값의 묶음. 원본 필드/시각을 다시 만들거나 변환하지 않는다.
    // 원본 gw_* 저장 문자열을 통째로 저장. 스탬프는 읽을 때 변환하지 않는다.
    static JSONObject validBackup(String text) throws Exception {
        if (text == null || text.getBytes(StandardCharsets.UTF_8).length > MAX_BACKUP_BYTES)
            throw new IllegalArgumentException("size");
        JSONObject all = new JSONObject(text);
        if (all.length() == 0) throw new IllegalArgumentException("empty");
        for (Iterator<String> it=all.keys();it.hasNext();) {
            String k=it.next();
            if (!k.startsWith("gw_") || !(all.get(k) instanceof String)) throw new IllegalArgumentException("key");
        }
        JSONObject v=new JSONObject(all.getString("gw_save_v1"));
        if (v.optInt("v",-1)!=1 || !(v.opt("clr") instanceof JSONObject)
            || !(v.opt("seen") instanceof JSONObject) || !(v.opt("party") instanceof JSONObject)
            || !(v.opt("gear") instanceof JSONArray) || !(v.opt("eq") instanceof JSONObject))
            throw new IllegalArgumentException("schema");
        for(String k:new String[]{"heroXP","corrupt","rampage","purifyDialogue"})
            if(v.has(k)&&!(v.get(k) instanceof JSONObject))throw new IllegalArgumentException("field");
        if(v.has("t")){
            Object stamp=v.get("t");
            if(!(stamp instanceof Number)||!Double.isFinite(v.getDouble("t"))
                ||v.getDouble("t")<0||v.getDouble("t")>9007199254740991L
                ||v.getDouble("t")!=v.getLong("t"))throw new IllegalArgumentException("time");
        }
        return all;
    }

    static boolean newerBackup(JSONObject remote, JSONObject local) throws Exception {
        return saveTime(remote) > saveTime(local);
    }
    static long saveTime(JSONObject all) {
        try { JSONObject checked = validBackup(all.toString());
            JSONObject s = new JSONObject(checked.getString("gw_save_v1"));
            if (!s.has("t")) return 0;
            if (!(s.get("t") instanceof Number) || !Double.isFinite(s.getDouble("t"))
                || s.getDouble("t") < 0 || s.getDouble("t") != s.getLong("t")) return -1;
            return s.getLong("t");
        } catch (Exception e) { return -1; }
    }
    static JSONObject latestBackup(JSONObject... candidates) {
        JSONObject best = null; long time = -1;
        for (JSONObject c : candidates) { long t = saveTime(c); if (t > time) { best = c; time = t; } }
        return best;
    }

    private String readDocument(Uri u) throws Exception {
        try (InputStream in = getContentResolver().openInputStream(u); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) throw new IllegalArgumentException();
            byte[] buf = new byte[65536]; int n;
            while ((n = in.read(buf)) != -1) { if (out.size() + n > MAX_BACKUP_BYTES) throw new IllegalArgumentException(); out.write(buf, 0, n); }
            return out.toString("UTF-8");
        }
    }
    private String readDocumentTimed(Uri u) throws Exception {
        documentBusy = true;
        Future<String> read = documentIO.submit(() -> { try { return readDocument(u); } finally { documentBusy = false; } });
        try { return read.get(READ_WAIT_SECONDS, TimeUnit.SECONDS); } finally { read.cancel(true); }
    }
    // 쓰기는 시간이 지나도 취소하지 않는다. "wt"로 비운 뒤 끊으면 끊긴 파일이 남기 때문이다.
    private void writeDocument(Uri u, String text) throws Exception {
        documentBusy = true;
        Future<?> write = documentIO.submit(() -> {
            try (OutputStream out = getContentResolver().openOutputStream(u, "wt")) {
                if (out == null) throw new IllegalStateException();
                out.write(text.getBytes(StandardCharsets.UTF_8));
            } catch (Exception e) { throw new IllegalStateException(e); }
            finally { documentBusy = false; }
        });
        write.get(WRITE_WAIT_SECONDS, TimeUnit.SECONDS);
    }
    // 비었거나 깨진 파일은 null. 호출하는 쪽이 이 기기의 유효한 저장으로 덮어써 복구한다.
    static JSONObject parseRemote(String raw) {
        try {
            if (raw == null || raw.trim().isEmpty()) return null;
            JSONObject remote = validBackup(raw);
            return saveTime(remote) < 0 ? null : remote;
        } catch (Exception e) { return null; }
    }

    // 저장 때는 읽지 않고 쓰기만 한다. 이번 실행에서 아직 파일을 확인하지 못했으면 먼저 읽어 확인한다.
    private void writeBackup() {
        if (conflictPending) return;
        if (!sessionSynced) { requestSync(false); return; }
        final Uri u = backupUri();
        synchronized (backupLock) {
            if (u == null || !pageReady || pickingBackup || restoringBackup || checkingRemote) return;
            if (!isOnline() || documentBusy) { writeDirty = true; return; }
            checkingRemote = true;
        }
        backupIO.execute(() -> {
            try {
                JSONObject local;
                synchronized (backupLock) { local = snapshot(); }
                long t = saveTime(local);
                if (t < 0 || t <= baseT()) return;
                writeDocument(u, local.toString());
                setBaseT(t);
                backupPrefs.edit().putLong("backupAt", System.currentTimeMillis()).remove("error").apply();
            } catch (Exception e) {
                backupPrefs.edit().putString("error", "동기화 대기").apply();
            } finally {
                checkingRemote = false;
                if (writeDirty) { writeDirty = false; queueBackup(false); }
                backupNotice("");
            }
        });
    }

    // 시작/복귀/재연결/저장 때 모두 읽기→t 비교→적용 또는 쓰기 순서로 처리한다.
    private void requestSync(boolean gate) {
        final Uri u = backupUri();
        synchronized (backupLock) {
            if (!pageReady || pickingBackup || restoringBackup || checkingRemote || conflictPending) return;
            if (u == null || !isOnline() || documentBusy) {
                js("window.onGwSyncDone&&window.onGwSyncDone()");backupNotice("");return;
            }
            checkingRemote = true;
        }
        if (gate) js("window.onGwSyncStart&&window.onGwSyncStart()");
        backupIO.execute(() -> {
            boolean reload = false, ask = false;
            try {
                String raw = readDocumentTimed(u); // 읽기 자체가 실패하면 오류로 끝낸다(파일은 건드리지 않음)
                JSONObject remote = parseRemote(raw); // 빈 파일·깨진 파일은 null → 이 기기 저장으로 복구
                JSONObject local;
                long lt, rt = saveTime(remote);
                int d;
                synchronized (backupLock) {
                    local = snapshot(); // 읽기를 기다리는 동안 생긴 로컬 진행까지 포함해 비교한다.
                    lt = saveTime(local);
                    d = decide(lt, rt, baseT());
                    if (d == SYNC_APPLY) {
                        restoringBackup = true;
                        try { replaceStore(remote); } catch (Exception e) { restoringBackup = false; throw e; }
                        awaitingRestoreReload = true; reload = true;
                    } else if (d == SYNC_ASK) {
                        ask = true; conflictPending = true; pendingConflict = remote.toString();
                    }
                }
                if (d == SYNC_APPLY) {
                    setBaseT(rt);
                    js("window.onGwBackupApplied&&window.onGwBackupApplied(" + JSONObject.quote(remote.toString()) + ")");
                } else if (d == SYNC_ASK) {
                    js("window.onGwSyncConflict&&window.onGwSyncConflict(" + JSONObject.quote(remote.toString()) + "," + JSONObject.quote(local.toString()) + ")");
                    return;
                } else if (d == SYNC_WRITE) {
                    writeDocument(u, local.toString());
                    setBaseT(lt);
                } else if (lt >= 0) setBaseT(lt);
                sessionSynced = true;
                backupPrefs.edit().putLong("backupAt", System.currentTimeMillis())
                    .putBoolean("held", false).putBoolean("linkPending", false).putBoolean("newFile", false).remove("error").apply();
            } catch (Exception e) {
                backupPrefs.edit().putString("error", "동기화 대기").apply();
            } finally {
                checkingRemote = false;
                if (!reload && !ask) js("window.onGwSyncDone&&window.onGwSyncDone()");
                if (!reload && !ask && writeDirty) { writeDirty = false; queueBackup(false); }
                backupNotice("");
            }
        });
    }

    private void readBackup() {
        final Uri u = backupUri();
        if (u == null) { js("window.onGwBackupFail&&window.onGwBackupFail('먼저 백업 파일을 골라 주세요.')"); return; }
        synchronized (backupLock) { if (restoringBackup) return; restoringBackup = true; }
        backupIO.execute(() -> {
            try {
                String text = readDocument(u);
                JSONObject all = validBackup(text);
                pendingRestore = all.toString();
                // 웹의 엄격한 JSON 검사까지 통과한 뒤 applyBackup에서 기기 저장을 교체한다.
                js("window.onGwRestore&&window.onGwRestore(" + JSONObject.quote(pendingRestore) + ")");
            } catch (Exception e) {
                restoringBackup = false;
                js("window.onGwBackupFail&&window.onGwBackupFail('불러올 수 없는 파일입니다. GENDER WARFARE 백업 파일과 연결 상태를 확인해 주세요. 기존 저장은 유지됩니다.')");
            }
        });
    }

    private void hideBars() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    private void requestHighestRefreshRate() {
        try {
            Display d = getWindowManager().getDefaultDisplay();
            float best = d.getRefreshRate();
            for (float r : d.getSupportedRefreshRates()) if (r > best) best = r;
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.preferredRefreshRate = best;
            getWindow().setAttributes(lp);
        } catch (Exception ignored) { }
    }

    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) hideBars(); }
    @Override protected void onResume() {
        super.onResume(); hideBars(); requestHighestRefreshRate();
        foreground = true;
        // Activity 생성 직후 첫 onResume은 webReady의 시작 동기화와 겹치므로 건너뛴다.
        // 그 다음부터의 실제 앱 복귀는 기존 규칙대로 Drive를 다시 확인한다.
        if (firstResume) firstResume = false; else requestSync(true);
        if (game != null) { game.resumeTimers(); game.onResume(); }
    }
    @Override protected void onPause() {
        foreground = false;
        if (game != null) { game.evaluateJavascript("try{if(window.GW&&GW.save)GW.save()}catch(e){}", r -> queueBackup(true)); game.onPause(); game.pauseTimers(); }
        super.onPause();
    }
    @Override protected void onDestroy() {
        if (connectivity != null && networkCallback != null) connectivity.unregisterNetworkCallback(networkCallback);
        pageReady = false;
        backupIO.shutdown();documentIO.shutdown();
        super.onDestroy();
    }

    // 뒤로 가기: 열린 창이 있으면 닫고, 없으면 두 번 눌러야 끝냄
    @Override public void onBackPressed() {
        new AlertDialog.Builder(this).setTitle("GENDER WARFARE")
            .setItems(new String[]{"계속 플레이", "Google Drive 저장 관리", "게임 종료"}, (d, which)->{
                if(which==1)js("window.GW_DRIVE&&window.GW_DRIVE.open()");
                else if(which==2)finish();
            }).show();
    }
}
