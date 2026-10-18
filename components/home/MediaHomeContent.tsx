import { useCarouselHeaderLayers } from '@/components/home/CarouselHeader';
import { HomeAtmosphereScrollView } from '@/components/home/HomeAtmosphereScrollView';
import type { GetMediaItemSource } from '@/components/media/mediaSource';
import { Section } from '@/components/media/Section';
import { SafeAreaRefreshControl } from '@/components/ui/SafeAreaRefreshControl';
import { UserViewSection } from '@/components/user-view/UserViewSection';
import { useContentDimensions, useLargeContentLayout } from '@/hooks/useContentDimensions';
import type { HomeSectionWithStatus } from '@/hooks/useHomeSections';
import { useAppTheme, useMediaHeroHeight } from '@/lib/theme';
import type { MediaItem } from '@/services/media/types';
import { useIsFocused } from 'expo-router/react-navigation';
import { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

export type MediaHomeSection = HomeSectionWithStatus & { onViewAll?: () => void };

/** Shared presentation for the account home and the all-account home. */
export function MediaHomeContent({
  carouselItems,
  isCarouselLoading,
  sections,
  getItemSource,
  showServerSource = true,
  refreshing = false,
  onRefresh,
  notice,
}: {
  carouselItems: MediaItem[];
  isCarouselLoading: boolean;
  sections: MediaHomeSection[];
  getItemSource?: GetMediaItemSource;
  showServerSource?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  notice?: React.ReactNode;
}) {
  const theme = useAppTheme();
  const phoneCarouselHeight = useMediaHeroHeight();
  const window = useContentDimensions();
  const tablet = useLargeContentLayout();
  const [viewportHeight, setViewportHeight] = useState(window.height);
  const measureViewport = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setViewportHeight(layout.height);
  }, []);
  const carouselHeight = tablet
    ? Math.round(Math.min(400, Math.max(220, window.width * 0.45), viewportHeight * 0.48))
    : phoneCarouselHeight;
  const isFocused = useIsFocused();
  const { backgroundImageInfo, headerImage, headerOverlay } = useCarouselHeaderLayers({
    items: carouselItems,
    height: carouselHeight,
    width: tablet ? window.width : undefined,
    isFocused,
    isLoading: isCarouselLoading,
    showLogo: true,
    getItemSource,
    showServerSource,
  });

  return (
    <HomeAtmosphereScrollView
      onLayout={tablet ? measureViewport : undefined}
      backgroundColor={theme.colors.background}
      contentStyle={{ gap: theme.spacing.xs, paddingBottom: theme.spacing.lg }}
      headerFadeMode="mask"
      headerHeight={carouselHeight}
      headerImage={headerImage}
      headerOverlay={headerOverlay}
      imageInfo={backgroundImageInfo}
      isDark={theme.isDark}
      optimizeAtmosphereImageLoading
      refreshControl={
        onRefresh ? (
          <SafeAreaRefreshControl
            underStatusBar
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.tint}
          />
        ) : undefined
      }
    >
      <View style={{ position: 'relative', gap: theme.spacing.lg, marginTop: theme.spacing.md }}>
        {notice}
        {sections.map((section) => {
          if (section.type === 'userview') {
            return (
              <UserViewSection
                key={section.key}
                title={section.title}
                userView={section.items}
                isLoading={section.isLoading}
                getItemSource={getItemSource}
                showServerSource={showServerSource}
              />
            );
          }
          if (!section.isLoading && section.items.length === 0) return null;
          return (
            <Section
              key={section.key}
              title={section.title}
              onViewAll={section.onViewAll}
              items={section.items}
              isLoading={section.isLoading}
              type={section.type === 'latest' ? 'series' : 'episode'}
              getItemSource={getItemSource}
              showServerSource={showServerSource}
            />
          );
        })}
      </View>
    </HomeAtmosphereScrollView>
  );
}
