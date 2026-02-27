module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  clearMocks: true,
  // Ensure native/Expo packages are transformed by Babel (not excluded).
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '(jest-)?react-native' +
      '|@react-native(-community)?' +
      '|expo(nent)?' +
      '|@expo(nent)?/.*' +
      '|@expo-google-fonts/.*' +
      '|react-navigation' +
      '|@react-navigation/.*' +
      '|@unimodules/.*' +
      '|unimodules' +
      '|react-native-svg' +
      '|victory-native' +
    '))',
  ],
  moduleNameMapper: {
    // Redirect AsyncStorage to the in-memory jest mock so storage tests
    // never touch the native module (which is null in a Jest environment).
    '@react-native-async-storage/async-storage':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
}
