import { useContentDimensions } from '@/hooks/useContentDimensions';
import { resolveGridLayout } from '@/lib/adaptiveLayout';
import { spacing } from '@/lib/theme';

export function useGridLayout(type?: 'series' | 'episode', minItemWidth?: number) {
  const { width } = useContentDimensions();
  return resolveGridLayout({
    width,
    gap: spacing.md,
    horizontalPadding: spacing.page,
    type,
    minItemWidth,
  });
}
