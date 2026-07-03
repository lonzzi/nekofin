import 'tsx/cjs';

import { ExpoConfig } from '@expo/config';

import packageJson from './package.json';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isPerformanceDiagnosticsEnabled } = require('./config/performanceDiagnostics.cjs') as {
  isPerformanceDiagnosticsEnabled: () => boolean;
};

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';
const ENABLE_PERFORMANCE_DIAGNOSTICS = isPerformanceDiagnosticsEnabled();

const getUniqueIdentifier = () => {
  if (IS_DEV) {
    return 'com.lonzzi.nekofin.dev';
  }

  if (IS_PREVIEW) {
    return 'com.lonzzi.nekofin.preview';
  }

  return 'com.lonzzi.nekofin';
};

const getAppName = () => {
  if (IS_DEV) {
    return 'nekofin (dev)';
  }

  if (IS_PREVIEW) {
    return 'nekofin (preview)';
  }

  return 'nekofin';
};

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  return {
    name: getAppName(),
    slug: 'nekofin',
    version: packageJson.version,
    orientation: 'default',
    icon: './assets/images/icon.png',
    scheme: 'nekofin',
    userInterfaceStyle: 'automatic',
    ios: {
      icon: './assets/images/nekofin.icon',
      supportsTablet: true,
      bundleIdentifier: getUniqueIdentifier(),
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
        UIBackgroundModes: ['audio', 'fetch'],
        NSLocalNetworkUsageDescription: 'This app needs access to the internet to play media.',
      },
    },
    android: {
      package: getUniqueIdentifier(),
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#1e1e1e',
      },
      permissions: [
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      ],
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#1e1e1e',
        },
      ],
      'expo-image',
      [
        'react-native-video',
        {
          enableNotificationControls: true,
          androidExtensions: {
            useExoplayerRtsp: false,
            useExoplayerSmoothStreaming: false,
            useExoplayerHls: false,
            useExoplayerDash: false,
          },
        },
      ],
      [
        'expo-screen-orientation',
        {
          initialOrientation: 'DEFAULT',
        },
      ],
      [
        'expo-sqlite',
        {
          enableFTS: true,
          useSQLCipher: true,
          android: {
            enableFTS: false,
            useSQLCipher: false,
          },
        },
      ],
      [
        'expo-build-properties',
        {
          ios: {
            buildReactNativeFromSource: true,
            reactNativeReleaseLevel: 'stable',
            deploymentTarget: '16.4',
          },
          android: {
            reactNativeReleaseLevel: 'stable',
            useAndroidX: true,
            usesCleartextTraffic: true,
          },
        },
      ],
      'expo-font',
      'expo-web-browser',
      [
        './plugins/withAbiFilters',
        {
          abiFilters: ['arm64-v8a'],
        },
      ],
      './plugins/withGradleJvmArgs',
      './plugins/withAndroidPip',
      ['./plugins/withDrawableAssets', './assets/drawables'],
      [
        './plugins/withIosImageAssets',
        ['./assets/icons/jellyfin-icon--color-on-light.png', './assets/icons/emby.svg'],
      ],
      'expo-mpv',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      enablePerformanceDiagnostics: ENABLE_PERFORMANCE_DIAGNOSTICS,
      router: {},
      eas: {
        projectId: 'b00bc9a1-4286-4cdc-ba7e-fb321575a32b',
      },
    },
    owner: 'lonzzi',
  };
};
