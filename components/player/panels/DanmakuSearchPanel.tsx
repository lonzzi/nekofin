import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
  NativeSettingsSwitch,
} from '@/components/ui/NativeSettings';
import {
  SettingsActionTitle,
  SettingsSubtitle,
  SettingsSymbol,
  SettingsTitle,
  SettingsValue,
} from '@/components/ui/SettingsVisual';
import { useDanmakuSources } from '@/lib/contexts/DanmakuSourcesContext';
import { getAnimeEpisodes, type DandanEpisode } from '@/services/dandanplay';
import {
  loadDanmakuSelections,
  searchDanmaku,
  type DanmakuCommentsData,
  type DanmakuEpisodeSelection,
  type SourcedDanmakuAnime,
} from '@/services/danmaku';
import { danmakuSourcesKey } from '@/services/danmakuSources';
import { Button, TextInput as NativeTextInput, useNativeState } from '@expo/ui';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { usePlayer } from '../PlayerContext';

type DanmakuSearchPanelProps = {
  ref?: Ref<DanmakuSearchPanelRef>;
  onCommentsLoaded: (data: DanmakuCommentsData) => void;
  onLoaded: () => void;
};
export type DanmakuSearchPanelRef = { cancelPending: () => void };

const episodeKey = (entry: DanmakuEpisodeSelection) =>
  entry.source.id + ':' + entry.episode.episodeId;

export function DanmakuSearchPanel({ ref, onCommentsLoaded, onLoaded }: DanmakuSearchPanelProps) {
  const { currentItem } = usePlayer();
  const { sources } = useDanmakuSources();
  const apiKey = danmakuSourcesKey(sources);
  const initialKeyword = currentItem?.seriesName ?? currentItem?.name ?? '';
  const keywordState = useNativeState(initialKeyword);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [apiIds, setApiIds] = useState(() =>
    sources.filter((source) => source.enabled).map((source) => source.id),
  );
  const [animes, setAnimes] = useState<SourcedDanmakuAnime[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<SourcedDanmakuAnime | null>(null);
  const [selections, setSelections] = useState<DanmakuEpisodeSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const cancelPending = useCallback(() => {
    requestId.current += 1;
    controller.current?.abort();
    setLoading(false);
    setError(null);
  }, []);
  const beginRequest = () => {
    controller.current?.abort();
    controller.current = new AbortController();
    setLoading(true);
    setError(null);
    return { id: ++requestId.current, signal: controller.current.signal };
  };
  useImperativeHandle(ref, () => ({ cancelPending }), [cancelPending]);
  useEffect(() => {
    setApiIds(sources.filter((source) => source.enabled).map((source) => source.id));
    setAnimes([]);
    setSelections([]);
    setSelectedAnime(null);
    cancelPending();
    // Names/addresses/enabled flags are represented by apiKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, cancelPending]);
  useEffect(
    () => () => {
      requestId.current += 1;
      controller.current?.abort();
    },
    [],
  );

  const handleSearch = async (submittedKeyword?: string) => {
    const query = (submittedKeyword ?? keyword).trim();
    if (!query || loading || !apiIds.length) return;
    const request = beginRequest();
    setSelectedAnime(null);
    setAnimes([]);
    try {
      const result = await searchDanmaku(
        query,
        sources.filter((source) => apiIds.includes(source.id)),
        request.signal,
        currentItem?.type === 'Movie' ? 1 : (currentItem?.indexNumber ?? undefined),
        currentItem?.parentIndexNumber ?? 1,
      );
      if (requestId.current !== request.id) return;
      setAnimes(result.animes);
      if (result.failedSources.length)
        setError(result.failedSources.join('、') + ' 暂不可用，其他结果仍可选择');
      else if (!result.animes.length) setError('没有找到匹配结果，换个关键词试试');
    } catch {
      if (requestId.current === request.id) setError('搜索失败，请检查网络后重试');
    } finally {
      if (requestId.current === request.id) setLoading(false);
    }
  };

  const handleAnimeSelect = async (entry: SourcedDanmakuAnime) => {
    if (loading) return;
    setSelectedAnime(entry);
    if (entry.anime.episodes.length) return;
    const request = beginRequest();
    try {
      const episodes = await getAnimeEpisodes(entry.anime, {
        baseUrl: entry.source.baseUrl,
        signal: request.signal,
      });
      if (requestId.current !== request.id) return;
      setSelectedAnime({ ...entry, anime: { ...entry.anime, episodes } });
    } catch {
      if (requestId.current === request.id) setError('剧集加载失败，请返回后重试');
    } finally {
      if (requestId.current === request.id) setLoading(false);
    }
  };

  const handleLoad = async () => {
    if (!selections.length || loading) return;
    const request = beginRequest();
    try {
      const data = await loadDanmakuSelections(selections, request.signal);
      if (requestId.current !== request.id) return;
      if (!data.tracks?.some((track) => track.comments.length)) {
        setError(data.failedSources?.length ? '弹幕加载失败，请稍后重试' : '所选剧集暂无弹幕');
        return;
      }
      onCommentsLoaded(data);
      AccessibilityInfo.announceForAccessibility('已加载 ' + data.tracks.length + ' 个匹配源');
      onLoaded();
    } catch {
      if (requestId.current === request.id) setError('弹幕加载失败，请稍后重试');
    } finally {
      if (requestId.current === request.id) setLoading(false);
    }
  };

  const toggleEpisode = (episode: DandanEpisode) => {
    if (!selectedAnime || loading) return;
    const entry = { ...selectedAnime, episode };
    const key = episodeKey(entry);
    setSelections((current) =>
      current.some((selection) => episodeKey(selection) === key)
        ? current.filter((selection) => episodeKey(selection) !== key)
        : [...current.filter((selection) => selection.key !== entry.key), entry],
    );
  };
  const loadButton = selections.length ? (
    <NativeSettingsSection footer="多选时默认合并，加载后可以在弹幕面板单独切换来源。">
      <NativeSettingsItem
        title={<SettingsTitle>{'已选 ' + selections.length + ' 个匹配源'}</SettingsTitle>}
        subtitle={
          <SettingsSubtitle
            primary={selections.map((entry) => entry.source.name).join('、')}
            lines={2}
          />
        }
        trailing={
          <SettingsValue label={loading ? '加载中…' : '加载'} tone={loading ? 'muted' : 'accent'} />
        }
        onPress={loading ? undefined : () => void handleLoad()}
        testID="player-danmaku-load-selection"
      />
    </NativeSettingsSection>
  ) : null;
  const errorSection = error ? (
    <NativeSettingsSection title="提示">
      <NativeSettingsItem
        leading={<SettingsSymbol name="exclamationmark.triangle" tone="danger" />}
        title={<SettingsTitle>{error}</SettingsTitle>}
      />
    </NativeSettingsSection>
  ) : null;
  const inputModifiers = Platform.OS === 'ios' ? [frame({ maxWidth: Infinity })] : [fillMaxWidth()];
  const searchDisabled = !keyword.trim() || loading || !apiIds.length;

  if (selectedAnime) {
    return (
      <NativeSettingsForm hosted surface="sheet" testID="player-danmaku-search">
        <NativeSettingsSection>
          <NativeSettingsItem
            leading={<SettingsSymbol name="chevron.backward" />}
            title={<SettingsTitle>返回搜索结果</SettingsTitle>}
            subtitle={
              <SettingsSubtitle
                primary={selectedAnime.source.name + ' · ' + selectedAnime.anime.animeTitle}
                lines={2}
              />
            }
            onPress={() => {
              cancelPending();
              setSelectedAnime(null);
            }}
          />
        </NativeSettingsSection>
        {loadButton}
        {errorSection}
        <NativeSettingsSection title={loading ? '正在加载…' : '选择剧集'}>
          {selectedAnime.anime.episodes.map((episode) => {
            const selected = selections.some(
              (entry) => episodeKey(entry) === selectedAnime.source.id + ':' + episode.episodeId,
            );
            return (
              <NativeSettingsItem
                key={episode.episodeId}
                title={<SettingsTitle>{episode.episodeTitle}</SettingsTitle>}
                trailing={
                  <SettingsValue
                    label={selected ? '已选择' : '选择'}
                    tone={selected ? 'accent' : 'muted'}
                  />
                }
                onPress={loading ? undefined : () => toggleEpisode(episode)}
              />
            );
          })}
          {!loading && !selectedAnime.anime.episodes.length ? (
            <NativeSettingsItem title={<SettingsTitle>这个条目没有可用剧集</SettingsTitle>} />
          ) : null}
        </NativeSettingsSection>
      </NativeSettingsForm>
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
              onChangeText={(value) => {
                cancelPending();
                setKeyword(value);
                setAnimes([]);
                setSelections([]);
              }}
              onSubmitEditing={(submitted) => void handleSearch(submitted)}
              placeholder="输入番剧或电影名称"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              modifiers={inputModifiers}
              style={{ height: 40 }}
              testID="player-danmaku-search-input"
            />
          }
          trailing={
            <Button
              variant="text"
              disabled={searchDisabled}
              onPress={() => void handleSearch()}
              style={{ height: 44, paddingHorizontal: 8 }}
              testID="player-danmaku-search-submit"
            >
              <SettingsActionTitle tone={searchDisabled ? 'muted' : 'accent'}>
                {loading ? '搜索中…' : '搜索'}
              </SettingsActionTitle>
            </Button>
          }
        />
      </NativeSettingsSection>
      <NativeSettingsSection
        title="搜索 API · 可多选"
        footer="同时搜索选中的 API，选择对应剧集后可以跨来源合并。"
      >
        {sources
          .filter((source) => source.enabled)
          .map((source) => (
            <NativeSettingsSwitch
              key={source.id}
              title={<SettingsTitle>{source.name}</SettingsTitle>}
              value={apiIds.includes(source.id)}
              onValueChange={(enabled) => {
                cancelPending();
                setAnimes([]);
                setApiIds((ids) =>
                  enabled ? [...ids, source.id] : ids.filter((id) => id !== source.id),
                );
                if (!enabled)
                  setSelections((entries) =>
                    entries.filter((entry) => entry.source.id !== source.id),
                  );
              }}
            />
          ))}
        {!sources.some((source) => source.enabled) ? (
          <NativeSettingsItem title={<SettingsTitle>请先在设置中启用弹幕 API</SettingsTitle>} />
        ) : null}
      </NativeSettingsSection>
      {loadButton}
      {errorSection}
      {sources
        .filter((source) => source.enabled && apiIds.includes(source.id))
        .map((source) => {
          const results = animes.filter((entry) => entry.source.id === source.id);
          return results.length ? (
            <NativeSettingsSection
              key={source.id}
              title={source.name + ' · ' + results.length + ' 个结果'}
            >
              {results.map((entry) => (
                <NativeSettingsItem
                  key={entry.key}
                  leading={<SettingsSymbol name="tv" />}
                  title={<SettingsTitle>{entry.anime.animeTitle}</SettingsTitle>}
                  subtitle={
                    <SettingsSubtitle
                      primary={
                        entry.anime.typeDescription +
                        ' · ' +
                        (entry.anime.episodes.length || entry.anime.episodeCount || 0) +
                        ' 集'
                      }
                    />
                  }
                  disclosure
                  onPress={() => void handleAnimeSelect(entry)}
                />
              ))}
            </NativeSettingsSection>
          ) : null;
        })}
    </NativeSettingsForm>
  );
}
