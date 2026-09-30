module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/*.ui.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.cjs'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-async-storage|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|lucide-react-native))',
  ],
};
