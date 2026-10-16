import { ItemImage } from '@/components/ItemImage';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/theme';
import type { MediaItem } from '@/services/media/types';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useDetailView } from './DetailViewContext';

type Props = {
  item: MediaItem;
  metadata?: ReactNode;
  controls?: ReactNode;
  overview?: ReactNode;
  children?: ReactNode;
};

export function DetailSummary({ item, metadata, controls, overview, children }: Props) {
  const theme = useAppTheme();
  const adapter = useMediaAdapter();
  const { title, item: detailItem } = useDetailView();
  const tablet = Platform.OS === 'ios' && Platform.isPad;
  const [width, setWidth] = useState(0);
  const wide = width >= 640;
  const heading = (
    <Text
      accessibilityRole="header"
      style={[styles.title, tablet && styles.tabletTitle, { color: theme.colors.text }]}
    >
      {title || item.name}
    </Text>
  );
  if (!tablet) {
    return (
      <View style={styles.summary}>
        {heading}
        {metadata}
        {controls}
        {overview}
        {children}
      </View>
    );
  }
  const logoItem = detailItem ?? item;
  const hasLogo =
    logoItem.imageTags?.Logo || (logoItem.parentLogoImageTag && logoItem.parentLogoItemId);
  const logoUrl = hasLogo
    ? adapter.getImageInfo({ item: logoItem, opts: { preferLogo: true, width: 600 } }).url
    : undefined;
  return (
    <View
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      style={styles.tabletSummary}
    >
      <View style={[styles.introduction, wide && styles.wideIntroduction]}>
        <View style={[styles.actions, wide && { width: Math.min(300, width * 0.32) }]}>
          {logoUrl ? (
            <ItemImage uri={logoUrl} contentFit="contain" style={styles.logo} fallback={heading} />
          ) : (
            heading
          )}
          {controls}
        </View>
        <View style={[styles.information, wide && styles.wideInformation]}>
          {logoUrl && item.type === 'Episode' ? heading : null}
          {metadata}
          {overview}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 8, width: '100%' },
  tabletSummary: { width: '100%', gap: 24, marginBottom: 16 },
  introduction: { gap: 24 },
  wideIntroduction: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  actions: { width: '100%', gap: 16 },
  logo: { width: '100%', maxWidth: 300, height: 72 },
  information: { minWidth: 0, gap: 12 },
  wideInformation: { flex: 1 },
  title: { fontSize: 24, fontWeight: 'bold' },
  tabletTitle: { fontSize: 28, lineHeight: 34 },
});
