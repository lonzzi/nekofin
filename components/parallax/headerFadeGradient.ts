import { Easing } from 'react-native';
import { easeGradient } from 'react-native-easing-gradient';

// Shared by both native renderers so their alpha curve stays identical.
const gradient = easeGradient({
  colorStops: {
    0: { color: 'rgba(0,0,0,1)' },
    0.66: { color: 'rgba(0,0,0,1)' },
    0.82: { color: 'rgba(0,0,0,0.96)' },
    1: { color: 'rgba(0,0,0,0)' },
  },
  easing: Easing.bezier(0.33, 0.0, 0.67, 1),
  extraColorStopsPerTransition: 36,
});

export const HEADER_FADE_COLORS = gradient.colors as unknown as readonly [
  string,
  string,
  ...string[],
];
export const HEADER_FADE_LOCATIONS = gradient.locations as unknown as readonly [
  number,
  number,
  ...number[],
];
