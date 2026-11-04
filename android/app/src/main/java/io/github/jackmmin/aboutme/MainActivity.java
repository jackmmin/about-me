package io.github.jackmmin.aboutme;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱에 직접 넣은 플러그인은 super.onCreate 전에 등록해야 한다.
        registerPlugin(BackupFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
