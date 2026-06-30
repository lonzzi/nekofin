import { AvatarImage } from '@/components/AvatarImage';
import PageScrollView from '@/components/PageScrollView';
import { AddServerMenu } from '@/components/servers/AddServerMenu';
import { GlassCard, ShadowedGlassCard } from '@/components/ui/GlassCard';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/design-system';
import { MediaServerInfo, type MediaServerType } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

const ONLINE_GREEN = '#34c759';
const SERVER_GRID_MIN_COLUMNS = 2;
const SERVER_CARD_MIN_WIDTH = 158;

function ServerAvatar({ server }: { server: MediaServerInfo }) {
  return <AvatarImage avatarUri={server.userAvatar} style={styles.avatarImage} />;
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
    return isCurrent ? ['#d8fae9', '#f6fff9'] : ['#ecfbf4', '#fbfffd'];
  }
  return isCurrent ? ['#f2e5fb', '#fff7ff'] : ['#f8f1fc', '#fffbff'];
}

function OnlineStatusDot() {
  const glowAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnimation, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [glowAnimation]);

  const glowStyle = {
    opacity: glowAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.42, 0.08],
    }),
    transform: [
      {
        scale: glowAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1.75],
        }),
      },
    ],
  };

  return (
    <View style={styles.onlineDotWrap}>
      <Animated.View style={[styles.onlineDotGlow, glowStyle]} />
      <View style={styles.onlineDot} />
    </View>
  );
}

function ServerCardAction({
  accessibilityLabel,
  children,
  onPress,
}: {
  accessibilityLabel: string;
  children: ReactNode;
  onPress: () => void;
}) {
  return (
    <GlassCard radius={15} style={styles.iconAction}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={(event) => {
          event.stopPropagation();
          onPress();
        }}
        style={({ pressed }) => [styles.iconActionInner, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    </GlassCard>
  );
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

  return (
    <GlassCard radius={22} style={styles.serverCard}>
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
                <OnlineStatusDot />
                <Text numberOfLines={2} style={[styles.serverName, { color: theme.colors.text }]}>
                  {server.name}
                </Text>
              </View>
              <View style={styles.serverSubtitleRow}>
                <ServerAvatar server={server} />
                <Text
                  numberOfLines={1}
                  style={[styles.serverSubtitle, { color: theme.colors.textSecondary }]}
                >
                  {server.username}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>

      <View style={styles.cardFooter}>
        <Text style={[styles.ageText, { color: theme.colors.textSecondary }]}>
          {formatServerAge(server.createdAt)}
        </Text>
        <View style={styles.footerActions}>
          <ServerCardAction accessibilityLabel={`配置 ${server.name}`} onPress={onConfig}>
            <Ionicons name="settings-outline" size={16} color={theme.colors.textSecondary} />
          </ServerCardAction>
          <ServerCardAction accessibilityLabel={`删除 ${server.name}`} onPress={onRemove}>
            <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
          </ServerCardAction>
        </View>
      </View>
    </GlassCard>
  );
}

export default function ServersScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { servers, removeServer, setCurrentServer, currentServer } = useMediaServers();
  const { width: viewportWidth } = useWindowDimensions();
  const serverGridGap = theme.spacing.md;

  const sortedServers = useMemo(
    () =>
      [...servers].sort((a, b) => {
        if (a.id === currentServer?.id) return -1;
        if (b.id === currentServer?.id) return 1;
        return a.name.localeCompare(b.name);
      }),
    [currentServer?.id, servers],
  );
  const serverCardWidth = useMemo(() => {
    const availableWidth = Math.max(viewportWidth - theme.spacing.page * 2, 0);
    const columnCount = Math.max(
      SERVER_GRID_MIN_COLUMNS,
      Math.floor((availableWidth + serverGridGap) / (SERVER_CARD_MIN_WIDTH + serverGridGap)),
    );
    return (availableWidth - (columnCount - 1) * serverGridGap) / columnCount;
  }, [serverGridGap, theme.spacing.page, viewportWidth]);
  const serverCardSlotStyle = useMemo(() => ({ width: serverCardWidth }), [serverCardWidth]);

  const openAddServer = useCallback(
    (serverType: MediaServerType) => {
      router.push({
        pathname: '/(tabs)/(servers)/add-server/[serverType]',
        params: { serverType },
      });
    },
    [router],
  );

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => <AddServerMenu onSelect={openAddServer} />,
    });
  }, [navigation, openAddServer]);

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
        </View>

        {sortedServers.length > 0 ? (
          <View style={[styles.serverGrid, { gap: serverGridGap }]}>
            {sortedServers.map((server) => (
              <View key={server.id} style={serverCardSlotStyle}>
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
          <ShadowedGlassCard
            radius={24}
            containerStyle={styles.emptyCardShadow}
            style={styles.emptyCard}
          >
            <CardText variant="title">还没有服务器</CardText>
            <CardText lines={2}>
              添加 Jellyfin 或 Emby 账号后，就可以浏览媒体库和播放记录。
            </CardText>
            <AddServerMenu onSelect={openAddServer} variant="text" />
          </ShadowedGlassCard>
        )}
      </PageScrollView>
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
    justifyContent: 'flex-start',
    gap: 12,
  },
  serverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  serverCard: {
    height: 132,
    padding: 14,
  },
  gradientOverlay: {
    opacity: 0.52,
  },
  cardOpenArea: {
    flex: 1,
  },
  cardOpenContent: {
    gap: 10,
  },
  cardHeader: {
    flex: 1,
  },
  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  serverNameRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  serverName: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  onlineDotWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  onlineDotGlow: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ONLINE_GREEN,
    shadowColor: ONLINE_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ONLINE_GREEN,
    shadowColor: ONLINE_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  serverSubtitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  serverSubtitleRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  avatarImage: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  cardFooter: {
    marginTop: 'auto',
    minHeight: 30,
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
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  iconAction: {
    width: 30,
    height: 30,
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
  emptyCardShadow: {
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 3,
  },
  emptyCard: {
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.64)',
    padding: 20,
  },
  pressed: {
    opacity: 0.72,
  },
});
