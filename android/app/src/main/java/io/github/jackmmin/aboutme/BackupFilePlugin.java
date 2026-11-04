package io.github.jackmmin.aboutme;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 백업 파일 저장: 시스템 파일 저장 화면(SAF)에서 위치를 고르게 하고, 웹에서 넘어오는 조각을 이어 쓴다.
 * create → write(여러 번) → close, 실패하면 abort로 만들던 파일을 지운다. (src/lib/backup/save.ts)
 */
@CapacitorPlugin(name = "BackupFile")
public class BackupFilePlugin extends Plugin {

    private static class OpenFile {
        final Uri uri;
        final OutputStream out;

        OpenFile(Uri uri, OutputStream out) {
            this.uri = uri;
            this.out = out;
        }
    }

    private final Map<String, OpenFile> files = new HashMap<>();

    @PluginMethod
    public void create(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mimeType", "application/zip"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("fileName", "about-me-backup.zip"));
        startActivityForResult(call, intent, "onCreateResult");
    }

    @ActivityCallback
    private void onCreateResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        JSObject ret = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }
        Uri uri = data.getData();
        try {
            OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt");
            if (out == null) throw new Exception("파일을 열 수 없습니다.");
            String id = UUID.randomUUID().toString();
            synchronized (files) {
                files.put(id, new OpenFile(uri, out));
            }
            ret.put("cancelled", false);
            ret.put("id", id);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("백업 파일을 만들지 못했습니다: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void write(PluginCall call) {
        OpenFile file = get(call);
        if (file == null) return;
        try {
            file.out.write(Base64.decode(call.getString("data", ""), Base64.DEFAULT));
            call.resolve();
        } catch (Exception e) {
            call.reject("백업 파일 쓰기 실패: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void close(PluginCall call) {
        OpenFile file = remove(call);
        if (file == null) return;
        try {
            file.out.close();
            call.resolve();
        } catch (Exception e) {
            call.reject("백업 파일 저장 실패: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void abort(PluginCall call) {
        OpenFile file = remove(call);
        if (file == null) return;
        try {
            file.out.close();
        } catch (Exception ignored) {}
        try {
            DocumentsContract.deleteDocument(getContext().getContentResolver(), file.uri);
        } catch (Exception ignored) {}
        call.resolve();
    }

    private OpenFile get(PluginCall call) {
        OpenFile file;
        synchronized (files) {
            file = files.get(call.getString("id", ""));
        }
        if (file == null) call.reject("열려 있는 백업 파일이 없습니다.");
        return file;
    }

    private OpenFile remove(PluginCall call) {
        OpenFile file;
        synchronized (files) {
            file = files.remove(call.getString("id", ""));
        }
        if (file == null) call.reject("열려 있는 백업 파일이 없습니다.");
        return file;
    }
}
