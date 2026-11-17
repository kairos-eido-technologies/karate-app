package com.dojomanager.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends AppCompatActivity {
    private static final String TAG = "DojoManager";
    private WebView webView;
    private LocalServer localServer;
    private ValueCallback<Uri[]> filePathCallback;
    private long lastBackPressTime = 0;
    private Toast exitToast;

    private final ActivityResultLauncher<Intent> fileChooserLauncher = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(),
        result -> {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    if (result.getData().getClipData() != null) {
                        int count = result.getData().getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = result.getData().getClipData().getItemAt(i).getUri();
                        }
                    } else if (result.getData().getData() != null) {
                        results = new Uri[]{result.getData().getData()};
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        }
    );

    public class AndroidBridge {
        private final Activity activity;

        public AndroidBridge(Activity activity) {
            this.activity = activity;
        }

        @android.webkit.JavascriptInterface
        public void saveBackup(String jsonContent, String filename) {
            activity.runOnUiThread(() -> {
                try {
                    Uri fileUri = null;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                        fileUri = activity.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (fileUri != null) {
                            try (OutputStream os = activity.getContentResolver().openOutputStream(fileUri)) {
                                if (os != null) {
                                    os.write(jsonContent.getBytes(StandardCharsets.UTF_8));
                                    os.flush();
                                }
                            }
                        }
                    } else {
                        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                        if (!downloadsDir.exists()) downloadsDir.mkdirs();
                        File file = new File(downloadsDir, filename);
                        try (FileOutputStream fos = new FileOutputStream(file)) {
                            fos.write(jsonContent.getBytes(StandardCharsets.UTF_8));
                            fos.flush();
                        }
                    }

                    Toast.makeText(activity, "Saved to Downloads: " + filename, Toast.LENGTH_LONG).show();

                    // Open Android Share / Save sheet so user can easily save to Drive, WhatsApp, etc.
                    try {
                        Intent shareIntent = new Intent(Intent.ACTION_SEND);
                        shareIntent.setType("application/json");
                        shareIntent.putExtra(Intent.EXTRA_SUBJECT, filename);
                        if (fileUri != null) {
                            shareIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
                            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        } else {
                            shareIntent.putExtra(Intent.EXTRA_TEXT, jsonContent);
                        }
                        activity.startActivity(Intent.createChooser(shareIntent, "Save or Share Database Backup"));
                    } catch (Exception ignored) {}

                } catch (Exception e) {
                    Log.e(TAG, "Failed to save backup", e);
                    Toast.makeText(activity, "Save backup error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void printDocument(String htmlContent, String documentName) {
            activity.runOnUiThread(() -> {
                try {
                    android.print.PrintManager printManager = (android.print.PrintManager) activity.getSystemService(android.content.Context.PRINT_SERVICE);
                    if (printManager != null) {
                        WebView printWebView = new WebView(activity);
                        printWebView.setWebViewClient(new WebViewClient() {
                            @Override
                            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                                return false;
                            }
                            @Override
                            public void onPageFinished(WebView view, String url) {
                                android.print.PrintDocumentAdapter printAdapter = printWebView.createPrintDocumentAdapter(documentName);
                                printManager.print(documentName, printAdapter, new android.print.PrintAttributes.Builder().build());
                            }
                        });
                        printWebView.loadDataWithBaseURL("file:///android_asset/", htmlContent, "text/html", "UTF-8", null);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Failed to print document", e);
                    Toast.makeText(activity, "Print error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void shareReceiptImage(String dataUrl, String filename, String phoneNumber, String caption) {
            activity.runOnUiThread(() -> {
                try {
                    String base64Data = dataUrl;
                    if (base64Data.contains(",")) {
                        base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
                    }
                    byte[] imageBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);

                    File cacheDir = new File(activity.getCacheDir(), "receipts");
                    if (!cacheDir.exists()) cacheDir.mkdirs();
                    File file = new File(cacheDir, filename);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(imageBytes);
                        fos.flush();
                    }

                    Uri contentUri = androidx.core.content.FileProvider.getUriForFile(
                        activity,
                        activity.getPackageName() + ".fileprovider",
                        file
                    );

                    Intent shareIntent = new Intent(Intent.ACTION_SEND);
                    shareIntent.setType("image/png");
                    shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                    if (caption != null && !caption.isEmpty()) {
                        shareIntent.putExtra(Intent.EXTRA_TEXT, caption);
                    }
                    shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                    // Open directly in WhatsApp if available, otherwise show share chooser
                    shareIntent.setPackage("com.whatsapp");
                    try {
                        activity.startActivity(shareIntent);
                    } catch (Exception e) {
                        shareIntent.setPackage(null);
                        activity.startActivity(Intent.createChooser(shareIntent, "Share Receipt"));
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Failed to share receipt image", e);
                    Toast.makeText(activity, "Share receipt error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Status bar styling - clean white background with dark readable icons
        try {
            getWindow().setStatusBarColor(Color.parseColor("#FFFFFF"));
            WindowInsetsControllerCompat windowController = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (windowController != null) {
                windowController.setAppearanceLightStatusBars(true);
            }
        } catch (Exception ignored) {}

        // Handle Status Bar & Camera Notch Safe Insets
        FrameLayout rootLayout = findViewById(R.id.root_layout);
        ViewCompat.setOnApplyWindowInsetsListener(rootLayout, (v, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() |
                WindowInsetsCompat.Type.displayCutout()
            );
            v.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return windowInsets;
        });

        // Start embedded in-app HTTP server
        localServer = new LocalServer(this);
        int port = localServer.start();

        webView = findViewById(R.id.webview);
        WebView.setWebContentsDebuggingEnabled(true);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // Native bridge for direct export to phone Downloads & Share
        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://wa.me") || url.startsWith("whatsapp://")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "WhatsApp is not installed", Toast.LENGTH_SHORT).show();
                        return true;
                    }
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "[JS] " + consoleMessage.message() + " (" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() + ")");
                return true;
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    fileChooserLauncher.launch(intent);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        // Launch directly into the dashboard without any login prompt
        String startUrl = "http://127.0.0.1:" + port + "/dashboard";
        Log.i(TAG, "Loading URL: " + startUrl);
        webView.loadUrl(startUrl);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (localServer != null) {
            localServer.stop();
        }
    }

    @Override
    public void onBackPressed() {
        long currentTime = System.currentTimeMillis();
        // If pressed twice within 2000ms, exit application immediately
        if (currentTime - lastBackPressTime < 2000) {
            if (exitToast != null) {
                exitToast.cancel();
            }
            finishAffinity();
            return;
        }

        // Navigate back in history if possible
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        }

        lastBackPressTime = currentTime;
        exitToast = Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT);
        exitToast.show();
    }
}
