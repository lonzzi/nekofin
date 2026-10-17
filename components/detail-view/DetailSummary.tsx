import { ItemImage } from '@/components/ItemImage';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAppTheme } from '@/lib/theme';
import type { MediaItem } from '@/services/media/types';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { InfoCard, InfoCardPlaceholderRows } from '../ui/InfoCard';
import { SkeletonText } from '../ui/Skeleton';
import { detailViewStyles } from './common';
import { DetailPlaybackControlsPlaceholder } from './DetailPlaybackControls';
import { useDetailView } from './DetailViewContext';

type Props = {
  item: MediaItem;
  metadata?: ReactNode;
  controls?: ReactNode;
  overview?: ReactNode;
  children?: ReactNode;
};

export function DetailTitle({ title }: { title: string }) {
  const theme = useAppTheme();
  const tablet = Platform.OS === 'ios' && Platform.isPad;

  return (
    <Text
      accessibilityRole="header"
      style={[styles.title, tablet && styles.tabletTitle, { color: theme.colors.text }]}
    >
      {title}
    </Text>
  );
}

export function DetailSummary({ item, metadata, controls, overview, children }: Props) {
  const adapter = useMediaAdapter();
  const { title, item: detailItem } = useDetailView();
  const tablet = Platform.OS === 'ios' && Platform.isPad;
  const heading = <DetailTitle title={title || item.name} />;
  const logoItem = detailItem ?? item;
  const hasLogo =
    logoItem.imageTags?.Logo || (logoItem.parentLogoImageTag && logoItem.parentLogoItemId);
  const logoUrl =
    tablet && hasLogo
      ? adapter.getImageInfo({ item: logoItem, opts: { preferLogo: true, width: 600 } }).url
      : undefined;
  return (
    <DetailSummaryLayout
      heading={
        logoUrl ? (
          <ItemImage uri={logoUrl} contentFit="contain" style={styles.logo} fallback={heading} />
        ) : (
          heading
        )
      }
      secondaryHeading={logoUrl && item.type === 'Episode' ? heading : null}
      metadata={metadata}
      controls={controls}
      overview={overview}
    >
      {children}
    </DetailSummaryLayout>
  );
}

// Loading and loaded summaries use the same responsive layout and slot order.
function DetailSummaryLayout({
  heading,
  secondaryHeading,
  metadata,
  controls,
  overview,
  children,
}: Omit<Props, 'item'> & { heading: ReactNode; secondaryHeading?: ReactNode }) {
  const tablet = Platform.OS === 'ios' && Platform.isPad;
  const [width, setWidth] = useState(0);
  const wide = width >= 640;
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
  return (
    <View
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      style={styles.tabletSummary}
    >
      <View style={[styles.introduction, wide && styles.wideIntroduction]}>
        <View style={[styles.actions, wide && { width: Math.min(300, width * 0.32) }]}>
          {heading}
          {controls}
        </View>
        <View style={[styles.information, wide && styles.wideInformation]}>
          {secondaryHeading}
          {metadata}
          {overview}
        </View>
      </View>
      {children}
    </View>
  );
}

export function DetailSummaryPlaceholder({
  title,
  mode,
}: {
  title?: string;
  mode: 'series' | 'movie' | 'episode';
}) {
  const theme = useAppTheme();
  const tablet = Platform.OS === 'ios' && Platform.isPad;
  return (
    <View
      accessible
      accessibilityLabel="正在加载详情"
      accessibilityState={{ busy: true }}
      pointerEvents="none"
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <DetailSummaryLayout
          heading={
            title ? (
              <DetailTitle title={title} />
            ) : (
              <SkeletonText width="68%" textStyle={[styles.title, tablet && styles.tabletTitle]} />
            )
          }
          metadata={
            mode === 'episode' ? (
              <SkeletonText width="40%" textStyle={theme.typography.footnote} />
            ) : (
              <View style={detailViewStyles.metaPill}>
                <SkeletonText width={88} textStyle={detailViewStyles.meta} />
              </View>
            )
          }
          controls={mode !== 'series' ? <DetailPlaybackControlsPlaceholder /> : null}
          overview={
            <View style={detailViewStyles.overviewContainer}>
              <View>
                {(['100%', '94%', '64%'] as const).map((width) => (
                  <SkeletonText key={width} width={width} textStyle={detailViewStyles.overview} />
                ))}
              </View>
            </View>
          }
        >
          {mode !== 'episode' && !tablet ? (
            <View style={detailViewStyles.infoBlock}>
              <InfoCard>
                <InfoCardPlaceholderRows />
              </InfoCard>
            </View>
          ) : null}
        </DetailSummaryLayout>
      </View>
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
