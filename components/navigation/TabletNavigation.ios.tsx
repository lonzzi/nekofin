import { useOuterTheme } from '@/lib/theme/OuterTheme';
import { embeddedNavigationBar } from '@/modules/native-layout';
import {
  Host,
  Label,
  List,
  NavigationLink,
  NavigationSplitView,
  RNHostView,
  Section,
  VStack,
} from '@expo/ui/swift-ui';
import {
  background,
  ignoreSafeArea,
  listStyle,
  navigationBarTitleDisplayMode,
  navigationSplitViewColumnWidth,
  navigationSplitViewStyle,
  navigationTitle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useRouter, useSegments } from 'expo-router';
import { useCallback, useMemo, useState, type ComponentProps, type PropsWithChildren } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { tabletDestinationKey, tabletDestinations } from './tabletDestinations';
import { TabletSidebarContext } from './TabletSidebarContext';

export function TabletNavigation({ children }: PropsWithChildren) {
  return Platform.OS === 'ios' && Platform.isPad ? (
    <SplitNavigation>{children}</SplitNavigation>
  ) : (
    children
  );
}

function SplitNavigation({ children }: PropsWithChildren) {
  const theme = useOuterTheme();
  const router = useRouter();
  const segments = useSegments();
  const selected = tabletDestinationKey(segments);
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
              {(['媒体', '设置'] as const).map((section) => (
                <Section key={section} title={section}>
                  {tabletDestinations
                    .filter((entry) => entry.section === section)
                    .map((entry) => (
                      <NavigationLink
                        key={entry.key}
                        value={entry.key}
                        modifiers={[tag(entry.key)]}
                      >
                        <Label title={entry.title} systemImage={entry.icon} />
                      </NavigationLink>
                    ))}
                </Section>
              ))}
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
                  <View style={{ flex: 1 }}>{children}</View>
                </SafeAreaProvider>
              </RNHostView>
            </VStack>
          </NavigationSplitView.Detail>
        </NavigationSplitView>
      </Host>
    </TabletSidebarContext>
  );
}
