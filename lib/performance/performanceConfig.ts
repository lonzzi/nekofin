import Constants from 'expo-constants';

type RuntimeExtra = {
  enablePerformanceDiagnostics?: boolean;
};

const extra = Constants.expoConfig?.extra as RuntimeExtra | undefined;

export const isPerformanceDiagnosticsEnabled =
  __DEV__ && extra?.enablePerformanceDiagnostics === true;
