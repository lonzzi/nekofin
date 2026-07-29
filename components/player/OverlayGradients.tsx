import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { usePlayer } from './PlayerContext';

export function ContentOverlayScrim() {
  const { fadeAnim } = usePlayer();

  const fadeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.contentScrim, fadeAnimatedStyle]}
    />
  );
}

export function TopOverlayGradient() {
  const { fadeAnim } = usePlayer();

  const fadeAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value,
    };
  });

  return (
    <Animated.View
      style={[styles.topContainer, { left: 0, right: 0, top: 0 }, fadeAnimatedStyle]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.24)', 'rgba(0,0,0,0.0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.fill}
      />
    </Animated.View>
  );
}

export function BottomOverlayGradient() {
  const { fadeAnim } = usePlayer();

  const fadeAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value,
    };
  });

  return (
    <Animated.View
      style={[styles.bottomContainer, { left: 0, right: 0, bottom: 0 }, fadeAnimatedStyle]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.76)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.fill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contentScrim: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    zIndex: 5,
  },
  topContainer: {
    position: 'absolute',
    zIndex: 5,
    height: 150,
  },
  bottomContainer: {
    position: 'absolute',
    zIndex: 5,
    height: 230,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
});
