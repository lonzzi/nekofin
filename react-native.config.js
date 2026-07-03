const { isPerformanceDiagnosticsEnabled } = require('./config/performanceDiagnostics.cjs');

const performanceDiagnosticsEnabled = isPerformanceDiagnosticsEnabled();

module.exports = {
  dependencies: performanceDiagnosticsEnabled
    ? {}
    : {
        'react-native-nitro-modules': {
          platforms: {
            android: null,
            ios: null,
          },
        },
        'react-native-performance-toolkit': {
          platforms: {
            android: null,
            ios: null,
          },
        },
      },
};
