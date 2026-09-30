const { expo } = require('./app.json');

// Standalone local builds prove that the app works without network access.
// Development builds keep network permission for Metro.
module.exports = {
  ...expo,
  android: {
    ...expo.android,
    blockedPermissions: [
      ...expo.android.blockedPermissions,
      ...(process.env.COOPGUARD_OFFLINE_APK === '1' ? ['android.permission.INTERNET'] : []),
    ],
  },
};
