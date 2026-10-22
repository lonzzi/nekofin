import { ContentDimensionsProvider } from '@/hooks/useContentDimensions';
import { useTranslation } from '@/lib/i18n';
import { useOuterTheme } from '@/lib/theme/OuterTheme';
import { embeddedNavigationBar } from '@/modules/native-layout';
import { NativeTabSidebar } from '@/modules/native-layout/NativeTabSidebar.ios';
import {
  Button,
  Host,
  HStack,
  Image,
  Label,
  List,
  NavigationLink,
  NavigationSplitView,
  RNHostView,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  background,
  buttonStyle,
  clipShape,
  foregroundStyle,
  frame,
  ignoreSafeArea,
  listStyle,
  navigationBarTitleDisplayMode,
  navigationSplitViewColumnWidth,
  navigationSplitViewStyle,
  navigationTitle,
  resizable,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useRouter, useSegments } from 'expo-router';
import { useCallback, useMemo, useState, type ComponentProps, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { tabletDestinationKey, tabletDestinations } from './tabletDestinations';
import { TabletSidebarContext } from './TabletSidebarContext';
import { useSidebarServers } from './useSidebarServers';

export function TabletNavigation({ children }: PropsWithChildren) {
  if (Platform.OS !== 'ios' || !Platform.isPad) return children;
  return Number.parseInt(Platform.Version, 10) >= 18 ? (
    <AdaptiveTabNavigation>{children}</AdaptiveTabNavigation>
  ) : (
    <SplitNavigation>{children}</SplitNavigation>
  );
}

function AdaptiveTabNavigation({ children }: PropsWithChildren) {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const { items, homeServerId, selectServer } = useSidebarServers();
  return (
    <NativeTabSidebar
      style={{ flex: 1 }}
      serversTitle={tr('navigation.servers')}
      servers={items}
      selectedServerId={tabletDestinationKey(segments) === 'home' ? (homeServerId ?? '') : ''}
      onServerSelected={({ nativeEvent }) => {
        if (selectServer(nativeEvent.id)) router.navigate('/(tabs)/(home)');
      }}
    >
      {children}
    </NativeTabSidebar>
  );
}

function SplitNavigation({ children }: PropsWithChildren) {
  const { t: tr } = useTranslation();
  const theme = useOuterTheme();
  const router = useRouter();
  const segments = useSegments();
  const selected = tabletDestinationKey(segments);
  const { items: servers, homeServerId, selectServer } = useSidebarServers();
  const [visibility, setVisibility] =
    useState<ComponentProps<typeof NavigationSplitView>['columnVisibility']>('all');
  const [compactColumn, setCompactColumn] =
    useState<ComponentProps<typeof NavigationSplitView>['preferredCompactColumn']>('detail');
  const showSidebar = useCallback(() => {
    setVisibility('all');
    setCompactColumn('sidebar');
  }, []);
  const sidebar = useMemo(
    () => ({ isCollapsed: visibility === 'detailOnly', showSidebar }),
    [visibility, showSidebar],
  );

  return (
    <TabletSidebarContext value={sidebar}>
      <Host style={{ flex: 1 }} colorScheme={theme.colorScheme} seedColor={theme.colors.tint}>
        <NavigationSplitView
          columnVisibility={visibility}
          onColumnVisibilityChange={setVisibility}
          preferredCompactColumn={compactColumn}
          onPreferredCompactColumnChange={setCompactColumn}
          modifiers={[navigationSplitViewStyle('balanced')]}
        >
          <NavigationSplitView.Sidebar>
            <List
              selection={[selected]}
              onSelectionChange={([key]) => {
                const destination = tabletDestinations.find((entry) => entry.key === key);
                if (destination) {
                  router.navigate(destination.href);
                  setCompactColumn('detail');
                }
              }}
              modifiers={[
                listStyle('sidebar'),
                navigationTitle('NekoFin'),
                navigationBarTitleDisplayMode('large'),
                navigationSplitViewColumnWidth({ min: 260, ideal: 280, max: 320 }),
              ]}
            >
              <Section title={tr('media.media')}>
                {tabletDestinations.map((entry) => (
                  <NavigationLink key={entry.key} value={entry.key} modifiers={[tag(entry.key)]}>
                    <Label title={entry.title} systemImage={entry.icon} />
                  </NavigationLink>
                ))}
              </Section>
              {servers.length ? (
                <Section title={tr('navigation.servers')}>
                  {servers.map((server) => (
                    <Button
                      key={server.id}
                      onPress={() => {
                        if (!selectServer(server.id)) return;
                        router.navigate('/(tabs)/(home)');
                        setCompactColumn('detail');
                      }}
                      modifiers={[buttonStyle('plain')]}
                    >
                      <HStack spacing={12}>
                        {server.avatarUri ? (
                          <Image
                            uiImage={server.avatarUri}
                            modifiers={[
                              resizable(),
                              frame({ width: 28, height: 28 }),
                              clipShape('circle'),
                            ]}
                          />
                        ) : (
                          <Image
                            systemName="externaldrive"
                            color={server.type === 'emby' ? '#34C759' : '#8B5CF6'}
                            modifiers={[frame({ width: 28, height: 28 })]}
                          />
                        )}
                        <Text modifiers={[foregroundStyle(theme.colors.text)]}>{server.name}</Text>
                        <Spacer />
                        {homeServerId === server.id ? (
                          <Image systemName="checkmark" size={14} color={theme.colors.tint} />
                        ) : null}
                      </HStack>
                    </Button>
                  ))}
                </Section>
              ) : null}
            </List>
          </NavigationSplitView.Sidebar>
          <NavigationSplitView.Detail>
            <VStack
              modifiers={[
                embeddedNavigationBar(),
                // UIKit owns the detail's safe areas, including its navigation bar.
                // Insetting its host here makes UIKit add a second toolbar margin.
                background(theme.colors.backgroundGrouped, { ignoresSafeAreaEdges: 'vertical' }),
                ignoreSafeArea({ regions: 'container', edges: 'vertical' }),
              ]}
            >
              <RNHostView>
                <SafeAreaProvider style={{ flex: 1 }}>
                  <ContentDimensionsProvider>{children}</ContentDimensionsProvider>
                </SafeAreaProvider>
              </RNHostView>
            </VStack>
          </NavigationSplitView.Detail>
        </NavigationSplitView>
      </Host>
    </TabletSidebarContext>
  );
}
