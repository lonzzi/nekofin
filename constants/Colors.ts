/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { SystemColors } from './SystemColor';

const tintColor = '#9C4DFF';

export const Colors = {
  light: {
    text: SystemColors.label.light,
    background: SystemColors.systemBackground.light,
    tint: tintColor,
    icon: SystemColors.secondaryLabel.light,
    tabIconDefault: SystemColors.secondaryLabel.light,
    tabIconSelected: tintColor,
  },
  dark: {
    text: SystemColors.label.dark,
    background: SystemColors.systemBackground.dark,
    tint: tintColor,
    icon: SystemColors.secondaryLabel.dark,
    tabIconDefault: SystemColors.secondaryLabel.dark,
    tabIconSelected: tintColor,
  },
};
