import { TabletChromeContext } from '@/components/navigation/TabletChromeContext';
import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import type { SearchMediaFilter } from '@/components/search/searchResultSections';
import { SearchResultsGrid } from '@/components/search/SearchResultsGrid';
import { useMediaServerSources } from '@/hooks/useMediaServerSources';
import { useNativeSearchHeader } from '@/hooks/useNativeSearchHeader';
import { useRefetchOnScreenFocus } from '@/hooks/useRefetchOnScreenFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useTranslation } from '@/lib/i18n';
import { formatList } from '@/lib/i18n/formatters';
import { useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { aggregateSearchQueries, aggregateSearchResults } from '@/services/media/aggregateSearch';
import { useQueries } from '@tanstack/react-query';
import { Stack, useFocusEffect } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { SearchBarCommands } from 'react-native-screens';

function AggregateSearchScreen() {
  const { t: tr } = useTranslation();
  const tabletChrome = useContext(TabletChromeContext);
  const androidTablet = tabletChrome != null;
  const focused = useIsFocused();
  const searchBar = useRef<SearchBarCommands>(null);
  const searchHeader = useNativeSearchHeader();
  useFocusEffect(
    useCallback(() => {
      if (!androidTablet) return;
      const frame = requestAnimationFrame(() => searchBar.current?.focus());
      return () => {
        cancelAnimationFrame(frame);
        searchBar.current?.blur();
      };
    }, [androidTablet]),
  );
  const { activeServers: servers } = useMediaServers();
  const sources = useMediaServerSources(servers);
  const theme = useAppTheme();
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<SearchMediaFilter>('all');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => clearTimeout(timer);
  }, [keyword]);
  const hasKeyword = keyword.trim().length > 0;
  const currentKeyword = hasKeyword && keyword.trim() === debounced;
  // Removing the old observers cancels their requests immediately, including during debounce.
  const queries = useQueries({
    queries: aggregateSearchQueries({ sources, keyword: currentKeyword ? debounced : '' }),
  });
  const search = useMemo(() => aggregateSearchResults(sources, queries), [sources, queries]);
  useRefetchOnScreenFocus({
    isEnabled: currentKeyword && sources.length > 0,
    isStale: queries.some((query) => query.isStale),
    fetchStatus: queries.some((query) => query.isFetching) ? 'fetching' : 'idle',
    refetch: () =>
      Promise.allSettled(queries.filter((query) => query.isStale).map((query) => query.refetch())),
  });
  const pending = hasKeyword && (!currentKeyword || search.isLoading);
  const allFailed = sources.length > 0 && search.failedServers.length === sources.length;
  return (
    <>
      <OuterScreenOptions title={tr('search.title')} />
      <Stack.SearchBar
        {...searchHeader}
        ref={searchBar}
        autoFocus={androidTablet && focused}
        placeholder={
          servers.length === 1
            ? tr('search.serverPlaceholder', { name: servers[0].name })
            : tr('search.allServers')
        }
        hideWhenScrolling={false}
        cancelButtonText={tr('common.cancel')}
        textColor={theme.colors.text}
        hintTextColor={theme.colors.textSecondary}
        headerIconColor={theme.colors.text}
        onChangeText={(e) => setKeyword(e.nativeEvent.text)}
        onCancelButtonPress={() => setKeyword('')}
      />
      <SearchResultsGrid
        groups={search.groups}
        filter={filter}
        onFilterChange={setFilter}
        state={!hasKeyword ? 'idle' : pending ? 'loading' : 'ready'}
        pendingServerCount={currentKeyword ? search.pendingServerCount : 0}
        notice={
          search.failedServers.length
            ? tr('search.incomplete', { servers: formatList(search.failedServers) })
            : undefined
        }
        emptyState={{
          icon: servers.length ? 'search' : 'server',
          title: !servers.length
            ? tr('server.noneAdded')
            : hasKeyword
              ? allFailed
                ? tr('common.loadFailed')
                : tr('search.noResults')
              : tr('search.enterTitle'),
          description: !servers.length
            ? tr('server.addAccountFirst')
            : hasKeyword
              ? allFailed
                ? tr('search.failedCheckNetwork')
                : tr('danmaku.searchKeywordHint')
              : undefined,
        }}
      />
    </>
  );
}
export default withOuterTheme(AggregateSearchScreen);
