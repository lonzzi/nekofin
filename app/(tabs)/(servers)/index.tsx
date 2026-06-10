import { AddServerForm } from '@/components/AddServerForm';
import { AvatarImage } from '@/components/AvatarImage';
import PageScrollView from '@/components/PageScrollView';
import { useGridLayout } from '@/hooks/useGridLayout';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/design-system';
import { MediaServerInfo } from '@/services/media/types';
import { BottomSheet } from '@expo/ui';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

function ServerAvatar({ server }: { server: MediaServerInfo }) {
  const theme = useAppTheme();

  return (
    <View style={styles.avatarWrap}>
      <AvatarImage avatarUri={server.userAvatar} style={styles.avatarImage} />
      <View
        style={[
          styles.serverDot,
          { backgroundColor: theme.colors.tint, borderColor: theme.colors.surface },
        ]}
      />
    </View>
  );
}

function CardText({
  children,
  variant = 'body',
  color,
  lines = 1,
}: {
  children: string;
  variant?: 'title' | 'body' | 'caption' | 'action';
  color?: string;
  lines?: number;
}) {
  const theme = useAppTheme();
  const style =
    variant === 'title'
      ? {
          color: color ?? theme.colors.text,
          fontSize: 18,
          fontWeight: '700' as const,
          lineHeight: 23,
        }
      : variant === 'action'
        ? {
            color: color ?? theme.colors.tint,
            fontSize: 15,
            fontWeight: '600' as const,
            lineHeight: 20,
          }
        : variant === 'caption'
          ? {
              color: color ?? theme.colors.textTertiary,
              fontSize: 13,
              fontWeight: '400' as const,
              lineHeight: 17,
            }
          : {
              color: color ?? theme.colors.textSecondary,
              fontSize: 14,
              fontWeight: '400' as const,
              lineHeight: 19,
            };

  return (
    <Text numberOfLines={lines} style={style}>
      {children}
    </Text>
  );
}

function formatServerAge(createdAt: number) {
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const diff = Date.now() - createdAt;
  const months = Math.max(0, Math.round(diff / monthMs));
  if (months <= 0) return '刚刚';
  if (months < 12) return `${months}月前`;
  return `${Math.round(months / 12)}年前`;
}

function getServerGradient(server: MediaServerInfo, isCurrent: boolean): [string, string] {
  if (server.type === 'emby') {
    return isCurrent ? ['#5ce0a0', '#9ef0c8'] : ['#9be9c0', '#c8f5dd'];
  }
  return isCurrent ? ['#d9a8f0', '#ecc9f7'] : ['#e0bdf2', '#f0dcf9'];
}

function ServerCard({
  server,
  isCurrent,
  onOpen,
  onConfig,
  onRemove,
}: {
  server: MediaServerInfo;
  isCurrent: boolean;
  onOpen: () => void;
  onConfig: () => void;
  onRemove: () => void;
}) {
  const theme = useAppTheme();
  const gradient = getServerGradient(server, isCurrent);
  const useGlass = isLiquidGlassAvailable();

  if (useGlass) {
    return (
      <GlassView style={styles.serverCard} glassEffectStyle="regular">
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.gradientOverlay]}
          pointerEvents="none"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`进入 ${server.name} 媒体库`}
          onPress={onOpen}
          style={({ pressed }) => [styles.cardOpenArea, pressed && styles.pressed]}
        >
          <View pointerEvents="none" style={styles.cardOpenContent}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleWrap}>
                <View style={styles.serverNameRow}>
                  <Text numberOfLines={1} style={[styles.serverName, { color: theme.colors.text }]}>
                    {server.name}
                  </Text>
                  <View style={[styles.onlineDot, { backgroundColor: '#34c759' }]} />
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.serverSubtitle, { color: theme.colors.textSecondary }]}
                >
                  {server.username}
                </Text>
              </View>
              <ServerAvatar server={server} />
            </View>
          </View>
        </Pressable>

        <View style={styles.cardFooter}>
          <Text style={[styles.ageText, { color: theme.colors.textSecondary }]}>
            {formatServerAge(server.createdAt)}
          </Text>
          <View style={styles.footerActions}>
            <>
              <GlassView glassEffectStyle="regular" style={styles.iconAction}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`配置 ${server.name}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    onConfig();
                  }}
                  style={({ pressed }) => [styles.iconActionInner, pressed && styles.pressed]}
                >
                  <Ionicons name="settings-outline" size={16} color={theme.colors.textSecondary} />
                </Pressable>
              </GlassView>
              <GlassView glassEffectStyle="regular" style={styles.iconAction}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`删除 ${server.name}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    onRemove();
                  }}
                  style={({ pressed }) => [styles.iconActionInner, pressed && styles.pressed]}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                </Pressable>
              </GlassView>
            </>
          </View>
        </View>
      </GlassView>
    );
  }

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.serverCard, { borderRadius: 20 }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`进入 ${server.name} 媒体库`}
        onPress={onOpen}
        style={({ pressed }) => [styles.cardOpenArea, pressed && styles.pressed]}
      >
        <View pointerEvents="none" style={styles.cardOpenContent}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleWrap}>
              <View style={styles.serverNameRow}>
                <Text numberOfLines={1} style={[styles.serverName, { color: theme.colors.text }]}>
                  {server.name}
                </Text>
                <View style={[styles.onlineDot, { backgroundColor: '#34c759' }]} />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.serverSubtitle, { color: theme.colors.textSecondary }]}
              >
                {server.username}
              </Text>
            </View>
            <ServerAvatar server={server} />
          </View>
        </View>
      </Pressable>

      <View style={styles.cardFooter}>
        <Text style={[styles.ageText, { color: theme.colors.textSecondary }]}>
          {formatServerAge(server.createdAt)}
        </Text>
        <View style={styles.footerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`配置 ${server.name}`}
            onPress={(event) => {
              event.stopPropagation();
              onConfig();
            }}
            style={({ pressed }) => [
              styles.iconAction,
              { backgroundColor: theme.colors.surface },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="settings-outline" size={16} color={theme.colors.textSecondary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`删除 ${server.name}`}
            onPress={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            style={({ pressed }) => [
              styles.iconAction,
              { backgroundColor: theme.colors.surface },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

export default function ServersScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { servers, removeServer, setCurrentServer, currentServer } = useMediaServers();
  const [isAddServerVisible, setIsAddServerVisible] = useState(false);
  const { itemWidth, gap } = useGridLayout();

  const sortedServers = useMemo(
    () =>
      [...servers].sort((a, b) => {
        if (a.id === currentServer?.id) return -1;
        if (b.id === currentServer?.id) return 1;
        return a.name.localeCompare(b.name);
      }),
    [currentServer?.id, servers],
  );

  const handleRemoveServer = (server: MediaServerInfo) => {
    Alert.alert('删除服务器', `从 Nekofin 移除 ${server.name} / ${server.username}？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void removeServer(server.id);
        },
      },
    ]);
  };

  return (
    <>
      <PageScrollView
        style={{ backgroundColor: theme.colors.backgroundGrouped }}
        contentContainerStyle={styles.container}
      >
        <View style={styles.headerRow}>
          <View>
            <CardText variant="body">{`${servers.length} 个服务器账号`}</CardText>
          </View>
          <GlassView glassEffectStyle="regular" style={styles.addButton}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsAddServerVisible(true)}
              style={({ pressed }) => [styles.addButtonInner, pressed && styles.pressed]}
            >
              <CardText variant="action">添加</CardText>
            </Pressable>
          </GlassView>
        </View>

        {sortedServers.length > 0 ? (
          <View style={[styles.serverGrid, { gap }]}>
            {sortedServers.map((server) => (
              <View key={server.id} style={{ width: itemWidth }}>
                <ServerCard
                  server={server}
                  isCurrent={currentServer?.id === server.id}
                  onOpen={() => {
                    setCurrentServer(server);
                    router.push('/(tabs)/(servers)/library');
                  }}
                  onConfig={() =>
                    router.push({
                      pathname: '/(tabs)/(servers)/server-config/[serverId]',
                      params: { serverId: server.id },
                    })
                  }
                  onRemove={() => handleRemoveServer(server)}
                />
              </View>
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.separator,
              },
            ]}
          >
            <CardText variant="title">还没有服务器</CardText>
            <CardText lines={2}>
              添加 Jellyfin 或 Emby 账号后，就可以浏览媒体库和播放记录。
            </CardText>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsAddServerVisible(true)}
              style={({ pressed }) => [
                styles.emptyAction,
                { backgroundColor: theme.colors.surfaceMuted },
                pressed && styles.pressed,
              ]}
            >
              <CardText variant="action">添加服务器</CardText>
            </Pressable>
          </View>
        )}
      </PageScrollView>

      <BottomSheet
        isPresented={isAddServerVisible}
        onDismiss={() => setIsAddServerVisible(false)}
        testID="add-media-account-sheet"
      >
        {isAddServerVisible ? <AddServerForm onClose={() => setIsAddServerVisible(false)} /> : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
  },
  headerRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  addButton: {
    minWidth: 68,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  serverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  serverCard: {
    minHeight: 110,
    overflow: 'hidden',
    borderRadius: 20,
    padding: 14,
  },
  gradientOverlay: {
    opacity: 0.7,
  },
  cardOpenArea: {
    flex: 1,
  },
  cardOpenContent: {
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  serverNameRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serverName: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: -10,
  },
  serverSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  serverDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  cardFooter: {
    marginTop: 'auto',
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ageText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  iconAction: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    gap: 10,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
  },
  emptyAction: {
    alignSelf: 'flex-start',
    minHeight: 38,
    borderRadius: 19,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.72,
  },
});
