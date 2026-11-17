package com.dojomanager.app;

import android.content.Context;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

public class LocalServer {
    private static final String TAG = "LocalServer";
    private final Context context;
    private ServerSocket serverSocket;
    private ExecutorService executor;
    private volatile boolean running = false;
    private int port = 8088;
    private ZipFile apkZip;
    private byte[] cachedIndexHtml;

    public LocalServer(Context context) {
        this.context = context.getApplicationContext();
    }

    public synchronized int start() {
        if (running) return port;

        try {
            apkZip = new ZipFile(new File(context.getApplicationInfo().sourceDir));
        } catch (Exception e) {
            Log.e(TAG, "Failed to open APK as ZipFile, will fallback to AssetManager", e);
        }

        // Preload index.html
        loadIndexHtml();

        // Try preferred port 8088, fallback to 8089..8099, then 0 (auto-assign)
        int[] candidatePorts = {8088, 8089, 8090, 8091, 0};
        for (int p : candidatePorts) {
            try {
                serverSocket = new ServerSocket(p, 50, InetAddress.getByName("127.0.0.1"));
                port = serverSocket.getLocalPort();
                break;
            } catch (IOException ignored) {}
        }

        if (serverSocket == null) {
            throw new RuntimeException("Could not bind LocalServer on 127.0.0.1");
        }

        running = true;
        executor = Executors.newCachedThreadPool();

        Thread acceptThread = new Thread(() -> {
            while (running) {
                try {
                    Socket socket = serverSocket.accept();
                    executor.submit(() -> handleRequest(socket));
                } catch (Exception e) {
                    if (!running) break;
                    Log.e(TAG, "Accept error", e);
                }
            }
        }, "LocalServer-Accept");
        acceptThread.setDaemon(true);
        acceptThread.start();

        Log.i(TAG, "LocalServer listening on http://127.0.0.1:" + port);
        return port;
    }

    public synchronized void stop() {
        running = false;
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (Exception ignored) {}
        if (executor != null) executor.shutdownNow();
        try {
            if (apkZip != null) apkZip.close();
        } catch (Exception ignored) {}
    }

    public int getPort() {
        return port;
    }

    private void loadIndexHtml() {
        byte[] bytes = readFileBytes("assets/index.html");
        if (bytes == null) {
            bytes = readFileBytes("index.html");
        }
        if (bytes != null) {
            cachedIndexHtml = bytes;
            Log.i(TAG, "Cached index.html (" + cachedIndexHtml.length + " bytes)");
        } else {
            Log.e(TAG, "Could not load index.html during initialization!");
        }
    }

    private void handleRequest(Socket socket) {
        try (InputStream in = new BufferedInputStream(socket.getInputStream());
             OutputStream out = socket.getOutputStream()) {

            // Read the first line of the HTTP request (GET /path HTTP/1.1)
            ByteArrayOutputStream lineBuf = new ByteArrayOutputStream();
            int b;
            while ((b = in.read()) != -1) {
                if (b == '\n') break;
                if (b != '\r') lineBuf.write(b);
            }

            String line = new String(lineBuf.toByteArray(), StandardCharsets.US_ASCII);
            if (line.isEmpty()) return;

            String[] parts = line.split(" ");
            if (parts.length < 2) return;

            String method = parts[0];
            String uri = parts[1];

            // Only GET and HEAD
            if (!"GET".equalsIgnoreCase(method) && !"HEAD".equalsIgnoreCase(method)) {
                sendResponse(out, 405, "Method Not Allowed", "text/plain", "Method Not Allowed".getBytes(StandardCharsets.UTF_8), method);
                return;
            }

            // Clean path
            String path = uri;
            int q = path.indexOf('?');
            if (q >= 0) path = path.substring(0, q);
            int h = path.indexOf('#');
            if (h >= 0) path = path.substring(0, h);
            try {
                path = URLDecoder.decode(path, "UTF-8");
            } catch (Exception ignored) {}

            while (path.startsWith("/")) {
                path = path.substring(1);
            }
            path = path.replace('\\', '/');

            // Route matching:
            // 1. Root or SPA route (like "login", "dashboard", "fees", "attendance", "settings", "reports")
            // 2. Static asset with extension (like "_build/assets/styles-BFV2y1mD.css")
            boolean isFile = path.contains(".") && !path.endsWith(".html");

            if (!isFile) {
                // Return index.html for all SPA routes
                byte[] html = cachedIndexHtml;
                if (html == null) {
                    loadIndexHtml();
                    html = cachedIndexHtml;
                }
                if (html != null) {
                    sendResponse(out, 200, "OK", "text/html; charset=utf-8", html, method);
                } else {
                    sendResponse(out, 500, "Internal Server Error", "text/plain", "Missing index.html".getBytes(StandardCharsets.UTF_8), method);
                }
                return;
            }

            // Asset lookup
            byte[] fileBytes = findAssetBytes(path);
            if (fileBytes != null) {
                String mime = getMimeType(path);
                sendResponse(out, 200, "OK", mime, fileBytes, method);
            } else {
                Log.w(TAG, "Asset 404: " + path);
                sendResponse(out, 404, "Not Found", "text/plain", "Not Found".getBytes(StandardCharsets.UTF_8), method);
            }

        } catch (Exception e) {
            Log.e(TAG, "Error handling client request", e);
        }
    }

    private byte[] findAssetBytes(String path) {
        // Try multiple path variations to be 100% resilient
        String[] candidates = new String[]{
            "assets/" + path,
            path,
            "assets/build/" + (path.startsWith("_build/") ? path.substring(7) : (path.startsWith("build/") ? path.substring(6) : path)),
            "assets/_build/" + (path.startsWith("_build/") ? path.substring(7) : (path.startsWith("build/") ? path.substring(6) : path)),
            "build/" + (path.startsWith("_build/") ? path.substring(7) : path),
            "_build/" + (path.startsWith("build/") ? path.substring(6) : path)
        };

        for (String c : candidates) {
            byte[] b = readFileBytes(c);
            if (b != null && b.length > 0) return b;
        }

        // Try direct file name in assets/build/assets/
        int slash = path.lastIndexOf('/');
        if (slash >= 0) {
            String fileName = path.substring(slash + 1);
            byte[] b = readFileBytes("assets/build/assets/" + fileName);
            if (b != null && b.length > 0) return b;
            b = readFileBytes("assets/_build/assets/" + fileName);
            if (b != null && b.length > 0) return b;
        }

        return null;
    }

    private byte[] readFileBytes(String assetPath) {
        // Normalize
        while (assetPath.startsWith("/")) {
            assetPath = assetPath.substring(1);
        }

        // 1. Try ZipFile directly (no AAPT underscore exclusion)
        if (apkZip != null) {
            try {
                ZipEntry entry = apkZip.getEntry(assetPath);
                if (entry == null && !assetPath.startsWith("assets/")) {
                    entry = apkZip.getEntry("assets/" + assetPath);
                }
                if (entry != null) {
                    try (InputStream is = apkZip.getInputStream(entry)) {
                        return readAllBytes(is);
                    }
                }
            } catch (Exception ignored) {}
        }

        // 2. Try AssetManager
        try {
            String clean = assetPath;
            if (clean.startsWith("assets/")) {
                clean = clean.substring(7);
            }
            try (InputStream is = context.getAssets().open(clean)) {
                return readAllBytes(is);
            }
        } catch (Exception ignored) {}

        return null;
    }

    private byte[] readAllBytes(InputStream is) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] data = new byte[16384];
        int nRead;
        while ((nRead = is.read(data, 0, data.length)) != -1) {
            buffer.write(data, 0, nRead);
        }
        return buffer.toByteArray();
    }

    private void sendResponse(OutputStream out, int status, String message, String mime, byte[] data, String method) throws IOException {
        String headers = "HTTP/1.1 " + status + " " + message + "\r\n" +
            "Content-Type: " + mime + "\r\n" +
            "Content-Length: " + data.length + "\r\n" +
            "Connection: close\r\n" +
            "Access-Control-Allow-Origin: *\r\n" +
            "Cache-Control: no-cache, no-store, must-revalidate\r\n\r\n";

        out.write(headers.getBytes(StandardCharsets.US_ASCII));
        if (!"HEAD".equalsIgnoreCase(method)) {
            out.write(data);
        }
        out.flush();
    }

    private String getMimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html")) return "text/html; charset=utf-8";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript; charset=utf-8";
        if (lower.endsWith(".css")) return "text/css; charset=utf-8";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".json")) return "application/json; charset=utf-8";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ttf")) return "font/ttf";
        return "application/octet-stream";
    }
}
