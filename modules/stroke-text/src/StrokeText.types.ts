import type { ColorValue, StyleProp, TextStyle, ViewStyle } from 'react-native';

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
