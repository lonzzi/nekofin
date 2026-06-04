import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { easeGradient } from 'react-native-easing-gradient';

export default function BlurTabBarBackground() {
  const { colors, locations } = easeGradient({
    colorStops: {
      0: { color: 'black' },
      0.8: { color: 'rgba(0,0,0,0.9)' },
      1: { color: 'transparent' },
    },
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <MaskedView
        maskElement={
          <LinearGradient
            locations={locations as [number, number, number, number]}
            colors={colors as [string, string, string, string]}
            style={StyleSheet.absoluteFill}
          />
        }
        style={StyleSheet.absoluteFill}
      >
        <BlurView intensity={100} tint="systemChromeMaterial" style={StyleSheet.absoluteFill} />
      </MaskedView>
    </View>
  );
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
