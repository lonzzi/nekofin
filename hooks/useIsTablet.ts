import * as Device from 'expo-device';
import { Dimensions, Platform } from 'react-native';

export function useIsTablet() {
  const screen = Dimensions.get('screen');
  return (
    Device.deviceType === Device.DeviceType.TABLET ||
    Device.deviceType === Device.DeviceType.DESKTOP ||
    (Platform.OS === 'ios' && Platform.isPad) ||
    Math.min(screen.width, screen.height) >= 600
  );
}
