import { requireNativeView } from 'expo';
import * as React from 'react';

import { StrokeTextViewProps } from './StrokeText.types';

const NativeView: React.ComponentType<StrokeTextViewProps> = requireNativeView('StrokeText');

export default function StrokeTextView({
  text,
  color = '#000000',
  strokeColor,
  strokeWidth = 0,
  fontSize = 16,
  fontWeight = '400',
  fontFamily = 'System',
  letterSpacing = 0,
  lineHeight,
  textAlign = 'left',
  numberOfLines,
  style,
}: StrokeTextViewProps) {
  const props = {
    text,
    color,
    strokeColor,
    strokeWidth,
    fontSize,
    fontWeight,
    fontFamily,
    letterSpacing,
    lineHeight,
    textAlign,
    numberOfLines,
  };
  return (
    <NativeView
      style={[{ height: (lineHeight ?? fontSize * 1.5) * (numberOfLines ?? 1) }, style]}
      {...props}
    />
  );
}
