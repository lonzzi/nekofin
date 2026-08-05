import {
  NativeSettingsButton,
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import {
  SettingsSubtitle,
  SettingsSymbol,
  SettingsTitle,
  SettingsValue,
} from '@/components/ui/SettingsVisual';
import {
  getCommentsByEpisodeId,
  searchAnimesByKeyword,
  type DandanAnime,
  type DandanComment,
  type DandanEpisode,
} from '@/services/dandanplay';
import { List as NativeList, TextInput as NativeTextInput, useNativeState } from '@expo/ui';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

type DanmakuSearchPanelProps = {
  ref?: Ref<DanmakuSearchPanelRef>;
  onCommentsLoaded: (
    comments: DandanComment[],
    episodeInfo: { animeTitle: string; episodeTitle: string },
  ) => void;
  onLoaded: () => void;
};

export type DanmakuSearchPanelRef = {
  cancelPending: () => void;
};

export function DanmakuSearchPanel({ ref, onCommentsLoaded, onLoaded }: DanmakuSearchPanelProps) {
  const keywordState = useNativeState('');
  const [keyword, setKeyword] = useState('');
  const [animes, setAnimes] = useState<DandanAnime[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<DandanAnime | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const cancelPending = useCallback(() => {
    requestId.current += 1;
    setLoading(false);
    setError(null);
  }, []);

  useImperativeHandle(ref, () => ({ cancelPending }), [cancelPending]);

  useEffect(
    () => () => {
      requestId.current += 1;
    },
    [],
  );

  const handleSearch = useCallback(
    async (submittedKeyword?: string) => {
      const query = (submittedKeyword ?? keyword).trim();
      if (!query || loading) return;

      const currentRequest = ++requestId.current;
      setLoading(true);
      setError(null);
      setSelectedAnime(null);
      try {
        const results = await searchAnimesByKeyword(query);
        if (requestId.current !== currentRequest) return;
        setAnimes(results);
        if (results.length === 0) setError('没有找到匹配的番剧，换个关键词试试');
      } catch {
        if (requestId.current === currentRequest) setError('搜索失败，请检查网络后重试');
      } finally {
        if (requestId.current === currentRequest) setLoading(false);
      }
    },
    [keyword, loading],
  );

  const handleKeywordChange = useCallback((nextKeyword: string) => {
    requestId.current += 1;
    setKeyword(nextKeyword);
    setLoading(false);
    setError(null);
    setAnimes([]);
  }, []);

  const handleEpisodeSelect = useCallback(
    async (episode: DandanEpisode) => {
      if (!selectedAnime || loading) return;

      const currentRequest = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const comments = await getCommentsByEpisodeId(episode.episodeId);
        if (requestId.current !== currentRequest) return;
        onCommentsLoaded(comments, {
          animeTitle: selectedAnime.animeTitle,
          episodeTitle: episode.episodeTitle,
        });
        AccessibilityInfo.announceForAccessibility(`已加载 ${comments.length} 条弹幕`);
        onLoaded();
      } catch {
        if (requestId.current === currentRequest) setError('弹幕加载失败，请稍后重试');
      } finally {
        if (requestId.current === currentRequest) setLoading(false);
      }
    },
    [loading, onCommentsLoaded, onLoaded, selectedAnime],
  );

  const showAnimeResults = !selectedAnime && animes.length > 0;
  const inputModifiers = Platform.OS === 'ios' ? [frame({ maxWidth: Infinity })] : [fillMaxWidth()];

  if (selectedAnime) {
    return (
      <NativeList testID="player-danmaku-search">
        <NativeSettingsItem
          leading={<SettingsSymbol name="chevron.backward" />}
          title={<SettingsTitle>返回搜索结果</SettingsTitle>}
          subtitle={<SettingsSubtitle primary={selectedAnime.animeTitle} lines={2} />}
          onPress={() => {
            requestId.current += 1;
            setLoading(false);
            setError(null);
            setSelectedAnime(null);
          }}
        />
        {error ? (
          <NativeSettingsItem
            leading={<SettingsSymbol name="exclamationmark.triangle" tone="danger" />}
            title={<SettingsTitle>{error}</SettingsTitle>}
          />
        ) : null}
        {selectedAnime.episodes.length > 0 ? (
          selectedAnime.episodes.map((episode, index) => (
            <NativeSettingsItem
              key={episode.episodeId}
              leading={<SettingsValue label={String(index + 1)} tone="muted" />}
              title={<SettingsTitle>{episode.episodeTitle}</SettingsTitle>}
              trailing={loading ? <SettingsValue label="加载中…" tone="muted" /> : undefined}
              disclosure={!loading}
              onPress={loading ? undefined : () => void handleEpisodeSelect(episode)}
            />
          ))
        ) : (
          <NativeSettingsItem title={<SettingsTitle>这个条目没有可用剧集</SettingsTitle>} />
        )}
      </NativeList>
    );
  }

  return (
    <NativeSettingsForm hosted surface="sheet" testID="player-danmaku-search">
      <NativeSettingsSection title="搜索番剧">
        <NativeSettingsItem
          leading={<SettingsSymbol name="magnifyingglass" />}
          title={
            <NativeTextInput
              value={keywordState}
              onChangeText={handleKeywordChange}
              onSubmitEditing={(submitted) => void handleSearch(submitted)}
              placeholder="输入番剧名称"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              modifiers={inputModifiers}
              style={{ height: 40 }}
              testID="player-danmaku-search-input"
            />
          }
        />
        <NativeSettingsButton
          label={loading ? '正在搜索…' : '搜索'}
          disabled={!keyword.trim() || loading}
          onPress={() => void handleSearch()}
        />
      </NativeSettingsSection>

      {error ? (
        <NativeSettingsSection title="提示">
          <NativeSettingsItem
            leading={<SettingsSymbol name="exclamationmark.triangle" tone="danger" />}
            title={<SettingsTitle>{error}</SettingsTitle>}
          />
        </NativeSettingsSection>
      ) : null}

      {showAnimeResults ? (
        <NativeSettingsSection title={`搜索结果 · ${animes.length}`}>
          {animes.map((anime) => (
            <NativeSettingsItem
              key={anime.animeId}
              leading={<SettingsSymbol name="tv" />}
              title={<SettingsTitle>{anime.animeTitle}</SettingsTitle>}
              subtitle={
                <SettingsSubtitle
                  primary={`${anime.typeDescription} · ${anime.episodes.length} 集`}
                />
              }
              disclosure
              onPress={() => {
                setError(null);
                setSelectedAnime(anime);
              }}
            />
          ))}
        </NativeSettingsSection>
      ) : null}

      {!loading && !error && !showAnimeResults ? (
        <NativeSettingsSection>
          <NativeSettingsItem
            leading={<SettingsSymbol name="sparkles" tone="muted" />}
            title={<SettingsTitle>搜索番剧后选择对应剧集</SettingsTitle>}
            subtitle={<SettingsSubtitle primary="建议使用正式中文名称" />}
          />
        </NativeSettingsSection>
      ) : null}
    </NativeSettingsForm>
  );
}
