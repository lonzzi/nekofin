import { ColorSchemeName } from 'react-native';

export type SystemColor = {
  light: string;
  dark: string;
};

export const SystemColors = {
  label: { light: '#000000', dark: '#FFFFFF' },
  secondaryLabel: { light: '#3C3C4399', dark: '#EBEBF599' },
  tertiaryLabel: { light: '#3C3C434C', dark: '#EBEBF54C' },
  quaternaryLabel: { light: '#3C3C432D', dark: '#EBEBF52D' },

  systemBackground: { light: '#FFFFFF', dark: '#000000' },
  secondarySystemBackground: { light: '#F2F2F7', dark: '#1C1C1E' },
  tertiarySystemBackground: { light: '#FFFFFF', dark: '#2C2C2E' },

  systemGroupedBackground: { light: '#F2F2F7', dark: '#000000' },
  secondarySystemGroupedBackground: { light: '#FFFFFF', dark: '#1C1C1E' },
  tertiarySystemGroupedBackground: { light: '#F2F2F7', dark: '#2C2C2E' },

  systemBlue: { light: '#007AFF', dark: '#0A84FF' },
  systemRed: { light: '#FF3B30', dark: '#FF453A' },
  systemGreen: { light: '#34C759', dark: '#30D158' },
  systemOrange: { light: '#FF9500', dark: '#FF9F0A' },
  systemYellow: { light: '#FFCC00', dark: '#FFD60A' },

  systemGray: { light: '#8E8E93', dark: '#8E8E93' },
  systemGray2: { light: '#AEAEB2', dark: '#636366' },
  systemGray3: { light: '#C7C7CC', dark: '#48484A' },
  systemGray4: { light: '#D1D1D6', dark: '#3A3A3C' },
  systemGray5: { light: '#E5E5EA', dark: '#2C2C2E' },
  systemGray6: { light: '#F2F2F7', dark: '#1C1C1E' },
};

export function getSystemColor(
  name: keyof typeof SystemColors,
  colorScheme: ColorSchemeName,
): string {
  return SystemColors[name][
    colorScheme === 'dark' || colorScheme === 'light' ? colorScheme : 'light'
  ];
}
