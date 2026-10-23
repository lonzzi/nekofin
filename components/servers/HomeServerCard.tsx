import { AvatarImage } from '@/components/AvatarImage';
import * as ContextMenu from '@/components/ui/ContextMenu';
import { GlassCard, SafeGlassContainer } from '@/components/ui/GlassCard';
import { t as tr, useTranslation } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import type { MediaServerInfo } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const ONLINE_GREEN = '#34c759';

function ServerAvatar({ server }: { server: MediaServerInfo }) {
  return <AvatarImage avatarUri={server.userAvatar} style={styles.avatarImage} />;
}

function formatServerAge(createdAt: number) {
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const diff = Date.now() - createdAt;
  const months = Math.max(0, Math.round(diff / monthMs));
  if (months <= 0) return tr('time.justNow');
  if (months < 12) return tr('time.monthsAgo', { months: months });
  return tr('time.yearsAgo', { value: Math.round(months / 12) });
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
      useGlassEffect={Platform.OS === 'ios'}
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

export function HomeServerCard({
  server,
  isCurrent,
  isScreenFocused,
  onOpen,
  onSettings,
  onRemove,
  onAccounts,
  accountCount,
}: {
  server: MediaServerInfo;
  isCurrent: boolean;
  isScreenFocused: boolean;
  onOpen: () => void;
  onSettings: () => void;
  onRemove: () => void;
  onAccounts: () => void;
  accountCount: number;
}) {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const gradient = getServerGradient(server, isCurrent, theme.isDark);
  const chrome = getServerCardChrome(theme.isDark);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <GlassCard
          colorScheme={theme.colorScheme}
          isInteractive
          radius={22}
          fallbackBackgroundColor={chrome.fallbackBackgroundColor}
          style={styles.serverCard}
          tintColor={chrome.tintColor}
          useGlassEffect={Platform.OS === 'ios'}
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
            accessibilityLabel={tr('media.openNamedLibrary', { name: server.name })}
            accessibilityHint={tr('server.settingsLongPressHint')}
            accessibilityActions={[{ name: 'settings', label: tr('server.settings') }]}
            onAccessibilityAction={({ nativeEvent }) => {
              if (nativeEvent.actionName === 'settings') onSettings();
            }}
            onPress={onOpen}
            onLongPress={() => {
              // The native context menu handles long press without opening the library.
            }}
            style={({ pressed }) => [styles.cardOpenArea, pressed && styles.pressed]}
          >
            <View pointerEvents="none" style={styles.cardOpenContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                  <View style={styles.serverNameRow}>
                    <OnlineStatusDot isActive={isScreenFocused} />
                    <Text
                      numberOfLines={2}
                      style={[styles.serverName, { color: theme.colors.text }]}
                    >
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
              {accountCount > 1
                ? tr('server.accountCount', { count: accountCount })
                : formatServerAge(server.createdAt)}
            </Text>
            <SafeGlassContainer spacing={8} style={styles.footerActions}>
              <ServerCardAction
                accessibilityLabel={tr('server.manageNamedAccounts', { name: server.name })}
                onPress={onAccounts}
              >
                <Ionicons name="people-outline" size={16} color={theme.colors.textSecondary} />
              </ServerCardAction>
              <ServerCardAction
                accessibilityLabel={tr('server.configureNamedServer', { name: server.name })}
                onPress={onSettings}
              >
                <Ionicons name="settings-outline" size={16} color={theme.colors.textSecondary} />
              </ServerCardAction>
            </SafeGlassContainer>
          </View>
        </GlassCard>
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <ContextMenu.Item key="open" onSelect={onOpen}>
          <ContextMenu.ItemTitle>{tr('media.openLibraryAction')}</ContextMenu.ItemTitle>
          <ContextMenu.ItemIcon ios={{ name: 'film' }} androidIconName="film" />
        </ContextMenu.Item>
        <ContextMenu.Item key="settings" onSelect={onSettings}>
          <ContextMenu.ItemTitle>{tr('server.settings')}</ContextMenu.ItemTitle>
          <ContextMenu.ItemIcon ios={{ name: 'gearshape' }} androidIconName="settings" />
        </ContextMenu.Item>
        <ContextMenu.Item key="accounts" onSelect={onAccounts}>
          <ContextMenu.ItemTitle>{tr('server.manageAccounts')}</ContextMenu.ItemTitle>
          <ContextMenu.ItemIcon ios={{ name: 'person.2' }} androidIconName="people" />
        </ContextMenu.Item>
        <ContextMenu.Item key="remove" destructive onSelect={onRemove}>
          <ContextMenu.ItemTitle>{tr('server.removeAccount')}</ContextMenu.ItemTitle>
          <ContextMenu.ItemIcon ios={{ name: 'trash' }} androidIconName="delete" />
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}

const styles = StyleSheet.create({
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
  pressed: { opacity: 0.72 },
});
