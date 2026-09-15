package com.github.polskiesladytaszkent;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

// Unlock user font-size
public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    getBridge().getWebView()
      .getSettings()
      .setTextZoom(100);
  }
}
