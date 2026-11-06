import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import { NativeScreenTitle } from '@/components/navigation/NativeScreenTitle';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useNativeSearchHeader } from '@/hooks/useNativeSearchHeader';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useTranslation } from '@/lib/i18n';
import {
  recommendedSearchItemsQueryOptions,
  searchItemsQueryOptions,
} from '@/services/media/queryOptions';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SearchBarCommands } from 'react-native-screens';

import type { SearchMediaFilter } from './searchResultSections';
import { SearchResultsGrid } from './SearchResultsGrid';

export default function ServerSearchScreen() {
  const { t: tr } = useTranslation();
  const { currentServer } = useMediaServers();
  const adapter = useMediaAdapter();
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<SearchMediaFilter>('all');
  const searchBar = useRef<SearchBarCommands>(null);
  const searchHeader = useNativeSearchHeader();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => clearTimeout(timer);
  }, [keyword]);
  const { data: recommendedData = [] } = useQueryWithFocus(
    recommendedSearchItemsQueryOptions({ adapter, currentServer }),
  );
  const hasKeyword = keyword.trim().length > 0;
  const currentKeyword = hasKeyword && keyword.trim() === debounced;
  const query = useQueryWithFocus(
    searchItemsQueryOptions({ adapter, currentServer, keyword: currentKeyword ? debounced : '' }),
  );
  const groups = useMemo(
    () =>
      currentServer
        ? [{ source: { server: currentServer, adapter }, items: query.data ?? [] }]
        : [],
    [currentServer, adapter, query.data],
  );
  const pending = hasKeyword && (!currentKeyword || query.isLoading);
  const header = (
    <>
      <NativeScreenTitle>
        {hasKeyword ? tr('search.title') : tr('media.recommended')}
      </NativeScreenTitle>
      <Stack.SearchBar
        {...searchHeader}
        ref={searchBar}
        placeholder={
          currentServer?.name
            ? tr('search.serverPlaceholder', { name: currentServer.name })
            : tr('search.placeholder')
        }
        onChangeText={(event) => setKeyword(event.nativeEvent.text)}
        onCancelButtonPress={() => setKeyword('')}
        hideWhenScrolling={false}
        cancelButtonText={tr('common.cancel')}
      />
    </>
  );

  return (
    <>
      {header}
      {hasKeyword ? (
        <SearchResultsGrid
          groups={groups}
          filter={filter}
          onFilterChange={setFilter}
          state={pending ? 'loading' : 'ready'}
          notice={
            query.isError && (query.data?.length ?? 0) > 0
              ? tr('search.failedCheckNetwork')
              : undefined
          }
          emptyState={{
            icon: 'search',
            title: query.isError ? tr('common.loadFailed') : tr('search.noResults'),
            description: query.isError
              ? tr('search.failedCheckNetwork')
              : tr('danmaku.searchKeywordHint'),
          }}
        />
      ) : (
        <ItemGridScreen
          title={tr('media.recommended')}
          data={recommendedData}
          type="series"
          disableGrouping
        />
      )}
    </>
  );
}
