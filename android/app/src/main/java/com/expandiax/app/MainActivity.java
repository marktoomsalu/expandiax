package com.expandiax.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own native parts (World Connect), before the bridge starts.
        registerPlugin(GlobeTouchPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
