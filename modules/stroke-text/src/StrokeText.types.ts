import type { ColorValue, StyleProp, TextStyle, ViewStyle } from 'react-native';

export type OnLoadEventPayload = {
  url: string;
};

export type StrokeTextModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
};

export type ChangeEventPayload = {
  value: string;
};

export type StrokeTextViewProps = {
  text: string;
  color?: ColorValue;
  strokeColor?: ColorValue;
  strokeWidth?: number;
  fontSize?: number;
  fontWeight?: TextStyle['fontWeight'];
  fontFamily?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: TextStyle['textAlign'];
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
};
