/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { SystemColors } from './SystemColor';

export const Colors = {
  light: {
    text: SystemColors.label.light,
    background: SystemColors.systemBackground.light,
    tint: SystemColors.systemBlue.light,
    icon: SystemColors.secondaryLabel.light,
    tabIconDefault: SystemColors.secondaryLabel.light,
    tabIconSelected: SystemColors.systemBlue.light,
  },
  dark: {
    text: SystemColors.label.dark,
    background: SystemColors.systemBackground.dark,
    tint: SystemColors.systemBlue.dark,
    icon: SystemColors.secondaryLabel.dark,
    tabIconDefault: SystemColors.secondaryLabel.dark,
    tabIconSelected: SystemColors.systemBlue.dark,
  },
};
