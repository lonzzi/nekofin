import { ItemImage } from '@/components/ItemImage';
import { getImagePreferenceOptions } from '@/components/media/cardHelpers';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { aggregateHomeQueryOptions } from '@/services/media/aggregateHome';
import type { MediaAdapter, MediaServerInfo } from '@/services/media/types';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as ContextMenu from 'zeego/context-menu';

export function HomeServerCard({
  server,
  adapter,
  onOpen,
  onSettings,
  single,
}: {
  server: MediaServerInfo;
  adapter: MediaAdapter;
  onOpen: () => void;
  onSettings: () => void;
  single: boolean;
}) {
  const latest = useQueryWithFocus(
    aggregateHomeQueryOptions({ adapter, server, section: 'latest' }),
  );
  const item = latest.data?.items[0];
  const image = item
    ? adapter.getImageInfo({ item, opts: getImagePreferenceOptions(ImageType.Backdrop) })
    : undefined;
  return (
    <View style={single ? styles.single : styles.gridItem}>
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`进入 ${server.name} 媒体库`}
            accessibilityHint="长按可打开服务器设置"
            accessibilityActions={[{ name: 'settings', label: '服务器设置' }]}
            onAccessibilityAction={({ nativeEvent }) => {
              if (nativeEvent.actionName === 'settings') onSettings();
            }}
            onPress={onOpen}
            onLongPress={() => {
              // The native menu owns long press; suppress Pressable's ordinary tap on release.
            }}
            style={({ pressed }) => [
              styles.card,
              { height: single ? 180 : 144, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <ItemImage
              uri={image?.url}
              placeholderBlurhash={image?.blurhash}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.caption}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={styles.name}
              >
                {server.name}
              </Text>
              <IconSymbol name="chevron.right" size={14} color="#fff" />
            </View>
          </Pressable>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item key="open" onSelect={onOpen}>
            <ContextMenu.ItemTitle>进入媒体库</ContextMenu.ItemTitle>
            <ContextMenu.ItemIcon ios={{ name: 'film' }} androidIconName="film" />
          </ContextMenu.Item>
          <ContextMenu.Item key="settings" onSelect={onSettings}>
            <ContextMenu.ItemTitle>服务器设置</ContextMenu.ItemTitle>
            <ContextMenu.ItemIcon ios={{ name: 'gearshape' }} androidIconName="settings" />
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>
    </View>
  );
}
const styles = StyleSheet.create({
  single: { width: '100%' },
  gridItem: { width: '48%' },
  card: {
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  caption: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: '#fff', fontSize: 17, fontWeight: '600', flex: 1 },
});
