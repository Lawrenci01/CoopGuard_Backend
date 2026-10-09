const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

// Internal PC-hosted builds trust this project's public CA as well as system CAs.
// No private key is ever copied into the application.
module.exports = function withLocalTls(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const managedPermissions = new Set([
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.CHANGE_NETWORK_STATE',
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.CHANGE_WIFI_STATE',
      'android.permission.NEARBY_WIFI_DEVICES',
      'android.permission.ACCESS_FINE_LOCATION',
    ]);
    manifest['uses-permission'] = (manifest['uses-permission'] || []).filter(
      (entry) => !managedPermissions.has(entry.$['android:name']),
    );
    manifest['uses-permission'].push(
      { $: { 'android:name': 'android.permission.INTERNET' } },
      { $: { 'android:name': 'android.permission.ACCESS_NETWORK_STATE' } },
      { $: { 'android:name': 'android.permission.CHANGE_NETWORK_STATE' } },
      { $: { 'android:name': 'android.permission.ACCESS_WIFI_STATE' } },
      { $: { 'android:name': 'android.permission.CHANGE_WIFI_STATE' } },
      {
        $: {
          'android:name': 'android.permission.NEARBY_WIFI_DEVICES',
          'android:usesPermissionFlags': 'neverForLocation',
        },
      },
      {
        $: {
          'android:name': 'android.permission.ACCESS_FINE_LOCATION',
          'android:maxSdkVersion': '32',
        },
      },
    );
    const app = manifest.application[0].$;
    app['android:usesCleartextTraffic'] = 'false';
    app['android:networkSecurityConfig'] = '@xml/network_security_config';
    return mod;
  });
  config = withMainApplication(config, (mod) => {
    if (!mod.modResults.contents.includes('CoopGuardWifiPackage()')) {
      const marker = 'PackageList(this).packages.apply {';
      if (!mod.modResults.contents.includes(marker))
        throw new Error('Could not register the CoopGuard Android WiFi package.');
      mod.modResults.contents = mod.modResults.contents.replace(
        marker,
        `${marker}\n          add(CoopGuardWifiPackage())`,
      );
    }
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const ca =
        process.env.CG_LOCAL_CA ||
        path.resolve(mod.modRequest.projectRoot, '../backend/.local/tls/ca.crt');
      if (!fs.existsSync(ca))
        throw new Error('Create the local HTTPS certificate first: cd backend && npm run tls');
      const res = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res');
      fs.mkdirSync(path.join(res, 'raw'), { recursive: true });
      fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
      fs.copyFileSync(ca, path.join(res, 'raw/coopguard_local_ca.crt'));
      fs.writeFileSync(
        path.join(res, 'xml/network_security_config.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="@raw/coopguard_local_ca" />
    </trust-anchors>
  </base-config>
</network-security-config>
`,
      );
      const packageName = config.android?.package || 'com.coopguard.app';
      const source = path.join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/java',
        ...packageName.split('.'),
      );
      fs.mkdirSync(source, { recursive: true });
      fs.writeFileSync(
        path.join(source, 'CoopGuardWifiPackage.kt'),
        `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class CoopGuardWifiPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(CoopGuardWifiModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`,
      );
      fs.writeFileSync(
        path.join(source, 'CoopGuardWifiModule.kt'),
        `package ${packageName}

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = CoopGuardWifiModule.NAME)
class CoopGuardWifiModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {
  companion object { const val NAME = "CoopGuardWifi" }

  private val connectivityManager =
    context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
  private var activeCallback: ConnectivityManager.NetworkCallback? = null
  private var pendingPromise: Promise? = null

  override fun getName(): String = NAME

  @Synchronized
  private fun releaseRequest(unbind: Boolean) {
    activeCallback?.let {
      try { connectivityManager.unregisterNetworkCallback(it) } catch (_: Exception) {}
    }
    activeCallback = null
    pendingPromise = null
    if (unbind) connectivityManager.bindProcessToNetwork(null)
  }

  @ReactMethod
  fun connect(ssid: String, passphrase: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.reject("UNSUPPORTED_ANDROID", "Automatic hub WiFi connection requires Android 10 or newer.")
      return
    }
    if (ssid.isBlank() || ssid.length > 32 || passphrase.length !in 8..63) {
      promise.reject("INVALID_HOTSPOT", "The hub hotspot details in this QR are invalid.")
      return
    }
    releaseRequest(unbind = true)
    pendingPromise = promise
    try {
      val specifier = WifiNetworkSpecifier.Builder()
        .setSsid(ssid)
        .setWpa2Passphrase(passphrase)
        .build()
      val request = NetworkRequest.Builder()
        .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
        .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        .setNetworkSpecifier(specifier)
        .build()
      val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
          connectivityManager.bindProcessToNetwork(network)
          pendingPromise?.resolve(true)
          pendingPromise = null
        }

        override fun onUnavailable() {
          pendingPromise?.reject(
            "HUB_WIFI_UNAVAILABLE",
            "The CoopGuard hotspot was not found or the connection request was declined.",
          )
          releaseRequest(unbind = true)
        }

        override fun onLost(network: Network) {
          if (connectivityManager.boundNetworkForProcess == network) {
            connectivityManager.bindProcessToNetwork(null)
          }
        }
      }
      activeCallback = callback
      connectivityManager.requestNetwork(request, callback, 45_000)
    } catch (error: SecurityException) {
      releaseRequest(unbind = true)
      promise.reject(
        "WIFI_PERMISSION",
        "Allow Nearby devices access so CoopGuard can connect to the farm hub.",
        error,
      )
    } catch (error: Exception) {
      releaseRequest(unbind = true)
      promise.reject("HUB_WIFI_FAILED", "Could not request the CoopGuard hotspot.", error)
    }
  }

  @ReactMethod
  fun disconnect(promise: Promise) {
    releaseRequest(unbind = true)
    promise.resolve(true)
  }
}
`,
      );
      return mod;
    },
  ]);
};
