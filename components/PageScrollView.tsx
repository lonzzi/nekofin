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
  const bottomContentInset = Platform.OS === 'ios' ? bottomTabBarHeight : 0;
  const bottomContentPadding =
    Platform.OS === 'ios' ? contentPaddingBottom : contentPaddingBottom + safePaddingBottom;
  const { contentInset, scrollIndicatorInsets, ...scrollViewProps } = rest;

  return (
    <ScrollView
      style={[{ flex: 1 }, style]}
      scrollToOverflowEnabled={true}
      nestedScrollEnabled
      contentInsetAdjustmentBehavior="automatic"
      contentInset={{
        ...contentInset,
        bottom: (contentInset?.bottom ?? 0) + bottomContentInset,
      }}
      scrollIndicatorInsets={{
        ...scrollIndicatorInsets,
        bottom: (scrollIndicatorInsets?.bottom ?? 0) + bottomContentInset,
      }}
      contentContainerStyle={[
        styles.contentContainer,
        contentContainerStyle,
        { paddingBottom: bottomContentPadding },
      ]}
      {...scrollViewProps}
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

const styles = StyleSheet.create({
  contentContainer: {
    flexGrow: 1,
  },
});
