import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import { Dimensions, PixelRatio, Platform } from 'react-native';

import packageJson from '../../package.json';

export function readDiagnosticEnvironment() {
  const screen = Dimensions.get('screen');
  return {
    application: {
      id: Application.applicationId,
      version: Application.nativeApplicationVersion,
      build: Application.nativeBuildVersion,
      releaseTag: Constants.expoConfig?.extra?.releaseTag,
      variant: Constants.expoConfig?.extra?.appVariant,
      javascriptVersion: Constants.expoConfig?.version,
      expoSdk: Constants.expoConfig?.sdkVersion,
      expoMpvDependency: packageJson.dependencies['expo-mpv'],
      reactNative: Platform.constants.reactNativeVersion,
      development: __DEV__,
      engine: 'HermesInternal' in globalThis ? 'Hermes' : 'JavaScriptCore / other',
      runtimeVersion: Updates.runtimeVersion,
      updateId: Updates.updateId,
      channel: Updates.channel,
      embeddedUpdate: Updates.isEmbeddedLaunch,
    },
    device: {
      platform: Platform.OS,
      physicalDevice: Device.isDevice,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utcOffsetMinutes: -new Date().getTimezoneOffset(),
      brand: Device.brand,
      manufacturer: Device.manufacturer,
      model: Device.modelName,
      modelId: Device.modelId,
      product: Device.productName,
      os: Device.osName,
      osVersion: Device.osVersion,
      osBuild: Device.osBuildId,
      androidApi: Device.platformApiLevel,
      cpuArchitectures: Device.supportedCpuArchitectures,
      totalMemoryBytes: Device.totalMemory,
      screen: {
        ...screen,
        widthPixels: Math.round(screen.width * screen.scale),
        heightPixels: Math.round(screen.height * screen.scale),
      },
      window: Dimensions.get('window'),
      pixelRatio: PixelRatio.get(),
    },
  };
}
