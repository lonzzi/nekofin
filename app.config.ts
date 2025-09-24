import 'tsx/cjs';

import { ExpoConfig } from '@expo/config';

import packageJson from './package.json';

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getUniqueIdentifier = () => {
  if (IS_DEV) {
    return 'com.lonzzi.nekofin.dev';
  }

  if (IS_PREVIEW) {
    return 'com.lonzzi.nekofin.preview';
  }

  return 'com.lonzzi.nekofin';
};

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  return {
    name: 'nekofin',
    slug: 'nekofin',
    version: packageJson.version,
    orientation: 'default',
    icon: './assets/images/icon.png',
    scheme: 'nekofin',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
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
      edgeToEdgeEnabled: true,
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
            useFrameworks: 'static',
            reactNativeReleaseLevel: 'experimental',
          },
          android: {
            reactNativeReleaseLevel: 'experimental',
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
      './plugins/withAndroidPip',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'b00bc9a1-4286-4cdc-ba7e-fb321575a32b',
      },
    },
    owner: 'lonzzi',
  };
};
