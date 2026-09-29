import 'react-native';

declare module 'react-native' {
  interface PressableStateCallbackType {
    /** Supplied by React Native Web; absent on native touch devices. */
    readonly hovered?: boolean;
  }
}
