const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

// Internal PC-hosted builds trust this project's public CA as well as system CAs.
// No private key is ever copied into the application.
module.exports = function withLocalTls(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest['uses-permission'] = (manifest['uses-permission'] || []).filter(
      (entry) => entry.$['android:name'] !== 'android.permission.INTERNET',
    );
    manifest['uses-permission'].push({ $: { 'android:name': 'android.permission.INTERNET' } });
    const app = manifest.application[0].$;
    app['android:usesCleartextTraffic'] = 'false';
    app['android:networkSecurityConfig'] = '@xml/network_security_config';
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
      return mod;
    },
  ]);
};
