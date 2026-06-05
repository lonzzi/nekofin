import React from 'react';
import { Platform, ScrollView, ScrollViewProps, StyleSheet } from 'react-native';

type PageScrollViewProps = {
  children: React.ReactNode;
  bottomTabBarHeight?: number;
} & ScrollViewProps;

export default function PageScrollView({
  children,
  style,
  contentContainerStyle,
  bottomTabBarHeight = 20,
  ...rest
}: PageScrollViewProps) {
  const flattenedContentStyle = StyleSheet.flatten(contentContainerStyle);
  const contentPaddingBottom = getNumericPaddingBottom(flattenedContentStyle);
  const safePaddingBottom = bottomTabBarHeight + (Platform.OS === 'android' ? 100 : 0);

  return (
    <ScrollView
      style={[{ flex: 1 }, style]}
      scrollToOverflowEnabled={true}
      nestedScrollEnabled
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        contentContainerStyle,
        { paddingBottom: contentPaddingBottom + safePaddingBottom },
      ]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

function getNumericPaddingBottom(style?: {
  padding?: unknown;
  paddingVertical?: unknown;
  paddingBottom?: unknown;
}) {
  if (typeof style?.paddingBottom === 'number') return style.paddingBottom;
  if (typeof style?.paddingVertical === 'number') return style.paddingVertical;
  if (typeof style?.padding === 'number') return style.padding;
  return 0;
}
