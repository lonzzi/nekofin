import { AvatarImage } from '@/components/AvatarImage';
import {
  ADD_SERVER_MENU_ACTIONS,
  ADD_SERVER_TOOLBAR_ACTION,
} from '@/components/navigation/nativeHeaderModel';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import PageScrollView from '@/components/PageScrollView';
import { AddServerMenu } from '@/components/servers/AddServerMenu';
import { GlassCard, SafeGlassContainer, ShadowedGlassCard } from '@/components/ui/GlassCard';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import { MediaServerInfo, type MediaServerType } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
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

function getServerGradient(
  server: MediaServerInfo,
  isCurrent: boolean,
  isDark: boolean,
): [string, string] {
  if (isDark) {
    if (server.type === 'emby') {
      return isCurrent
        ? ['rgba(34, 139, 92, 0.28)', 'rgba(14, 24, 19, 0.14)']
        : ['rgba(24, 108, 72, 0.20)', 'rgba(18, 23, 20, 0.10)'];
    }
    return isCurrent
      ? ['rgba(115, 72, 169, 0.30)', 'rgba(31, 20, 43, 0.14)']
      : ['rgba(88, 54, 132, 0.22)', 'rgba(25, 20, 32, 0.10)'];
  }

  if (server.type === 'emby') {
    return isCurrent ? ['#d8fae9', '#f6fff9'] : ['#ecfbf4', '#fbfffd'];
  }
  return isCurrent ? ['#f2e5fb', '#fff7ff'] : ['#f8f1fc', '#fffbff'];
}

function getServerCardChrome(isDark: boolean) {
  return {
    fallbackBackgroundColor: isDark ? 'rgba(20,20,24,0.58)' : 'rgba(255,255,255,0.52)',
    tintColor: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.10)',
  };
}

function OnlineStatusDot({ isActive }: { isActive: boolean }) {
  const glowAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isActive) {
      glowAnimation.stopAnimation();
      glowAnimation.setValue(0);
      return;
    }

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
  }, [glowAnimation, isActive]);

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
      {isActive ? (
        <Animated.View style={[styles.onlineDotGlow, glowStyle]} />
      ) : (
        <View style={[styles.onlineDotGlow, styles.onlineDotGlowIdle]} />
      )}
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
  const theme = useAppTheme();
  const chrome = getServerCardChrome(theme.isDark);

  return (
    <GlassCard
      colorScheme={theme.colorScheme}
      isInteractive
      radius={15}
      fallbackBackgroundColor={chrome.fallbackBackgroundColor}
      style={styles.iconAction}
      tintColor={theme.isDark ? 'rgba(255,255,255,0.06)' : chrome.tintColor}
      useGlassEffect
    >
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
  isScreenFocused,
  onOpen,
  onConfig,
  onRemove,
}: {
  server: MediaServerInfo;
  isCurrent: boolean;
  isScreenFocused: boolean;
  onOpen: () => void;
  onConfig: () => void;
  onRemove: () => void;
}) {
  const theme = useAppTheme();
  const gradient = getServerGradient(server, isCurrent, theme.isDark);
  const chrome = getServerCardChrome(theme.isDark);

  return (
    <GlassCard
      colorScheme={theme.colorScheme}
      isInteractive
      radius={22}
      fallbackBackgroundColor={chrome.fallbackBackgroundColor}
      style={styles.serverCard}
      tintColor={chrome.tintColor}
      useGlassEffect
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          StyleSheet.absoluteFill,
          theme.isDark ? styles.darkGradientOverlay : styles.gradientOverlay,
        ]}
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
                <OnlineStatusDot isActive={isScreenFocused} />
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
        <SafeGlassContainer spacing={8} style={styles.footerActions}>
          <ServerCardAction accessibilityLabel={`配置 ${server.name}`} onPress={onConfig}>
            <Ionicons name="settings-outline" size={16} color={theme.colors.textSecondary} />
          </ServerCardAction>
          <ServerCardAction accessibilityLabel={`删除 ${server.name}`} onPress={onRemove}>
            <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
          </ServerCardAction>
        </SafeGlassContainer>
      </View>
    </GlassCard>
  );
}

export default function ServersScreen() {
  const theme = useAppTheme();
  const router = useTracedRouter('servers');
  const navigation = useNavigation();
  const { servers, removeServer, setCurrentServer, currentServer, isInitialized } =
    useMediaServers();
  const [isFocused, setIsFocused] = useState(() => navigation.isFocused());
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
    const removeFocusListener = navigation.addListener('focus', () => setIsFocused(true));
    const removeBlurListener = navigation.addListener('blur', () => setIsFocused(false));

    return () => {
      removeFocusListener();
      removeBlurListener();
    };
  }, [navigation]);

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
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          accessibilityLabel={ADD_SERVER_TOOLBAR_ACTION.label}
          icon={getNativeToolbarIcon(
            ADD_SERVER_TOOLBAR_ACTION.androidDrawable,
            ADD_SERVER_TOOLBAR_ACTION.iosIcon,
          )}
        >
          <Stack.Toolbar.Label>{ADD_SERVER_TOOLBAR_ACTION.label}</Stack.Toolbar.Label>
          {ADD_SERVER_MENU_ACTIONS.map((action) => (
            <Stack.Toolbar.MenuAction key={action.key} onPress={() => openAddServer(action.key)}>
              {action.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
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
                  isScreenFocused={isFocused}
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
        ) : isInitialized ? (
          <ShadowedGlassCard
            colorScheme={theme.colorScheme}
            fallbackBackgroundColor={getServerCardChrome(theme.isDark).fallbackBackgroundColor}
            radius={24}
            containerStyle={styles.emptyCardShadow}
            style={styles.emptyCard}
            tintColor={getServerCardChrome(theme.isDark).tintColor}
            useGlassEffect
          >
            <CardText variant="title">还没有服务器</CardText>
            <CardText lines={2}>
              添加 Jellyfin 或 Emby 账号后，就可以浏览媒体库和播放记录。
            </CardText>
            <AddServerMenu onSelect={openAddServer} variant="text" />
          </ShadowedGlassCard>
        ) : (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.colors.tint} />
          </View>
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
  darkGradientOverlay: {
    opacity: 0.9,
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
  onlineDotGlowIdle: {
    opacity: 0.16,
    transform: [{ scale: 1 }],
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
    padding: 20,
  },
  loadingState: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
