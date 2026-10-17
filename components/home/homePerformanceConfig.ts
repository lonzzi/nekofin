import { getMediaRailListConfig } from '@/components/media/railPerformanceConfig';

const HOME_RAIL_CARD_WIDTHS = {
  episode: 220,
  series: 120,
  userView: 200,
} as const;

export type HomeRailType = keyof typeof HOME_RAIL_CARD_WIDTHS;

export function getHomeRailListConfig({
  gap,
  horizontalPadding,
  type,
  viewportWidth,
}: {
  gap: number;
  horizontalPadding: number;
  type: HomeRailType;
  viewportWidth: number;
}) {
  return getMediaRailListConfig({
    gap,
    horizontalPadding,
    cardWidth: HOME_RAIL_CARD_WIDTHS[type],
    viewportWidth,
  });
}

export const HOME_CAROUSEL_IMAGE_WIDTHS = {
  atmosphere: 160,
  hero: 1000,
} as const;
