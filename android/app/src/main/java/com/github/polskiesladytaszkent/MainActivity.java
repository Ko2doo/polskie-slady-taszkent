package com.github.polskiesladytaszkent;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

// Lock user font-size scaling
public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    getBridge().getWebView()
      .getSettings()
      .setTextZoom(100);
  }
}
