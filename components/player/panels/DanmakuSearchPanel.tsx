import {
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsPicker,
  NativeSettingsSection,
  NativeSettingsSwitch,
  type NativeSettingsOption,
} from '@/components/ui/NativeSettings';
import { SettingsSubtitle, SettingsSymbol, SettingsTitle } from '@/components/ui/SettingsVisual';
import { useDanmakuSources } from '@/lib/contexts/DanmakuSourcesContext';
import { useAppTheme } from '@/lib/theme';
import { getAnimeEpisodes, type DandanEpisode } from '@/services/dandanplay';
import {
  searchDanmaku,
  type DanmakuCommentsData,
  type DanmakuEpisodeSelection,
  type SourcedDanmakuAnime,
} from '@/services/danmaku';
import {
  createDanmakuEpisodeLoader,
  danmakuEpisodeCacheKey,
} from '@/services/danmakuEpisodeLoader';
import { findDandanEpisode } from '@/services/danmakuMatching';
import { danmakuSourcesKey } from '@/services/danmakuSources';
import { Text as NativeText, TextInput as NativeTextInput, Row, useNativeState } from '@expo/ui';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { Picker as SwiftPicker, Text as SwiftText } from '@expo/ui/swift-ui';
import {
  disabled as disabledModifier,
  frame,
  listRowSeparator,
  pickerStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { usePlayer } from '../PlayerContext';
import { DanmakuEpisodeRow } from './DanmakuEpisodeRow';
import { DanmakuSearchButton } from './DanmakuSearchButton';
import { danmakuLeafSelection, danmakuSeasonKey, danmakuSeasonOptions } from './danmakuSearchModel';

type DanmakuSearchPanelProps = {
  ref?: Ref<DanmakuSearchPanelRef>;
  onCommentsLoaded: (data: DanmakuCommentsData) => void;
  onLoaded: () => void;
  onNavigationChange: (navigation: { title: string; canGoBack: boolean }) => void;
};
export type DanmakuSearchPanelRef = { cancelPending: () => void; goBack: () => boolean };

function SearchTitle({ children }: { children: string }) {
  const theme = useAppTheme();
  return (
    <NativeText
      numberOfLines={3}
      textStyle={{ color: theme.colors.text, fontSize: 16, lineHeight: 21 }}
    >
      {children}
    </NativeText>
  );
}

function SearchPicker({
  title,
  value,
  options,
  onValueChange,
  disabled = false,
}: {
  title: string;
  value: string;
  options: NativeSettingsOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  if (Platform.OS !== 'ios') {
    return (
      <NativeSettingsPicker
        title={<SettingsTitle>{title}</SettingsTitle>}
        value={value}
        options={options}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    );
  }
  // A native Form picker supplies its own label and interaction; don't nest it in a row Button.
  return (
    <SwiftPicker
      label={title}
      selection={value}
      onSelectionChange={(next) => onValueChange(String(next))}
      modifiers={[
        pickerStyle('menu'),
        tint(theme.colors.textSecondary),
        disabledModifier(disabled),
      ]}
    >
      {options.map((option) => (
        <SwiftText key={option.value} modifiers={[tag(option.value)]}>
          {option.title}
        </SwiftText>
      ))}
    </SwiftPicker>
  );
}

export function DanmakuSearchPanel({
  ref,
  onCommentsLoaded,
  onLoaded,
  onNavigationChange,
}: DanmakuSearchPanelProps) {
  const { currentItem } = usePlayer();
  const { sources } = useDanmakuSources();
  const apiKey = danmakuSourcesKey(sources);
  const [episodeLoader] = useState(createDanmakuEpisodeLoader);
  const initialKeyword = currentItem?.seriesName ?? currentItem?.name ?? '';
  const keywordState = useNativeState(initialKeyword);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [apiIds, setApiIds] = useState(() =>
    sources.filter((source) => source.enabled).map((source) => source.id),
  );
  const [animes, setAnimes] = useState<SourcedDanmakuAnime[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<SourcedDanmakuAnime | null>(null);
  const [season, setSeason] = useState('all');
  const [editingSources, setEditingSources] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [loadingEpisodeKey, setLoadingEpisodeKey] = useState<string | null>(null);
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
  useImperativeHandle(
    ref,
    () => ({
      cancelPending,
      goBack: () => {
        if (!selectedAnime && !editingSources && !showResults) return false;
        cancelPending();
        if (selectedAnime) setSelectedAnime(null);
        else if (editingSources) setEditingSources(false);
        else setShowResults(false);
        return true;
      },
    }),
    [cancelPending, editingSources, selectedAnime, showResults],
  );
  useEffect(() => {
    onNavigationChange({
      title: editingSources
        ? '搜索 API'
        : selectedAnime
          ? '选择剧集'
          : showResults
            ? '选择季度 / 版本'
            : '搜索弹幕',
      canGoBack: editingSources || !!selectedAnime || showResults,
    });
  }, [editingSources, onNavigationChange, selectedAnime, showResults]);
  useEffect(() => {
    setApiIds(sources.filter((source) => source.enabled).map((source) => source.id));
    setAnimes([]);
    setSelectedAnime(null);
    setShowResults(false);
    setSeason('all');
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
    setSeason('all');
    setAnimes([]);
    try {
      // Manual browsing must include every season, even when the library uses absolute episode numbers.
      const result = await searchDanmaku(
        query,
        sources.filter((source) => apiIds.includes(source.id)),
        request.signal,
      );
      if (requestId.current !== request.id) return;
      setAnimes(result.animes);
      setShowResults(result.animes.length > 0);
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
    setError(null);
    setSelectedAnime(entry);
    if (entry.anime.episodes.length) return;
    const request = beginRequest();
    try {
      const episodes = await getAnimeEpisodes(entry.anime, {
        baseUrl: entry.source.baseUrl,
        signal: request.signal,
      });
      if (requestId.current !== request.id) return;
      const loaded = { ...entry, anime: { ...entry.anime, episodes } };
      setSelectedAnime(loaded);
      setAnimes((current) => current.map((result) => (result.key === entry.key ? loaded : result)));
    } catch {
      if (requestId.current === request.id) setError('剧集加载失败，请返回后重试');
    } finally {
      if (requestId.current === request.id) setLoading(false);
    }
  };

  const handleEpisodeSelect = async (entry: DanmakuEpisodeSelection) => {
    if (loading) return;
    const request = beginRequest();
    setLoadingEpisodeKey(danmakuEpisodeCacheKey(entry));
    try {
      const data = await episodeLoader.load(entry, request.signal, true);
      if (requestId.current !== request.id) return;
      if (!data.tracks?.some((track) => track.comments.length)) {
        setError(data.failedSources?.length ? '弹幕加载失败，请稍后重试' : '所选剧集暂无弹幕');
        return;
      }
      onCommentsLoaded(data);
      AccessibilityInfo.announceForAccessibility('已加载 ' + data.comments.length + ' 条弹幕');
      onLoaded();
    } catch {
      if (requestId.current === request.id) setError('弹幕加载失败，请稍后重试');
    } finally {
      if (requestId.current === request.id) {
        setLoading(false);
        setLoadingEpisodeKey(null);
      }
    }
  };

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
  const seasonOptions = danmakuSeasonOptions(animes);
  const playingEpisode = currentItem?.type === 'Movie' ? undefined : currentItem?.indexNumber;
  const playingContext =
    currentItem?.type === 'Movie'
      ? '当前播放：' + currentItem.name
      : '当前播放：第 ' +
        (currentItem?.parentIndexNumber ?? 1) +
        ' 季' +
        (playingEpisode == null ? '' : ' · 第 ' + playingEpisode + ' 集');

  const episodeRow = (episode: DandanEpisode, sameNumber = false) => {
    if (!selectedAnime) return null;
    const entry = { ...selectedAnime, episode };
    return (
      <DanmakuEpisodeRow
        key={episode.episodeId}
        entry={entry}
        loader={episodeLoader}
        disabled={loading}
        loading={loading && loadingEpisodeKey === danmakuEpisodeCacheKey(entry)}
        sameNumber={sameNumber}
        onPress={() => void handleEpisodeSelect(entry)}
      />
    );
  };

  if (editingSources) {
    return (
      <NativeSettingsForm hosted surface="sheet" testID="player-danmaku-search-sources">
        <NativeSettingsSection
          title="搜索 API · 可多选"
          footer="返回后搜索选中的 API，再点按对应剧集加载弹幕。"
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
                  setShowResults(false);
                  setSeason('all');
                  setApiIds((ids) =>
                    enabled ? [...ids, source.id] : ids.filter((id) => id !== source.id),
                  );
                }}
              />
            ))}
          {!sources.some((source) => source.enabled) ? (
            <NativeSettingsItem title={<SearchTitle>请先在设置中启用弹幕 API</SearchTitle>} />
          ) : null}
        </NativeSettingsSection>
      </NativeSettingsForm>
    );
  }

  if (selectedAnime) {
    const versions = animes.filter((entry) => entry.source.id === selectedAnime.source.id);
    const sameNumber = findDandanEpisode(selectedAnime.anime.episodes, playingEpisode);
    return (
      <NativeSettingsForm hosted surface="sheet" testID="player-danmaku-search">
        <NativeSettingsSection footer={selectedAnime.source.name + ' · ' + playingContext}>
          {versions.length > 1 ? (
            <SearchPicker
              title="季度 / 版本"
              value={selectedAnime.key}
              options={versions.map((entry) => ({
                value: entry.key,
                title: entry.anime.animeTitle,
              }))}
              disabled={loading}
              onValueChange={(key) => {
                const entry = versions.find((version) => version.key === key);
                if (entry) void handleAnimeSelect(entry);
              }}
            />
          ) : (
            <NativeSettingsItem
              title={<SearchTitle>{selectedAnime.anime.animeTitle}</SearchTitle>}
            />
          )}
        </NativeSettingsSection>
        {errorSection}
        {sameNumber ? (
          <NativeSettingsSection title="当前集号">
            {episodeRow(sameNumber, true)}
          </NativeSettingsSection>
        ) : null}
        <NativeSettingsSection
          title={loading ? '正在加载…' : '全部剧集 · ' + selectedAnime.anime.episodes.length}
        >
          {selectedAnime.anime.episodes
            .filter((episode) => String(episode.episodeId) !== String(sameNumber?.episodeId))
            .map((episode) => episodeRow(episode))}
          {!loading && !selectedAnime.anime.episodes.length ? (
            <NativeSettingsItem title={<SettingsTitle>这个条目没有可用剧集</SettingsTitle>} />
          ) : null}
        </NativeSettingsSection>
      </NativeSettingsForm>
    );
  }

  const results = (
    <>
      {errorSection}
      {sources
        .filter((source) => source.enabled && apiIds.includes(source.id))
        .map((source) => {
          const entries = animes.filter(
            (entry) =>
              entry.source.id === source.id &&
              (season === 'all' || danmakuSeasonKey(entry) === season),
          );
          return entries.length ? (
            <NativeSettingsSection
              key={source.id}
              title={source.name + ' · ' + entries.length + ' 个季度 / 版本'}
              footer="先确认季度、前后篇或特别篇，再选择剧集。"
            >
              {entries.map((entry) => {
                const leaf = danmakuLeafSelection(entry);
                if (leaf)
                  return (
                    <DanmakuEpisodeRow
                      key={entry.key}
                      entry={leaf}
                      title={
                        leaf.episode.episodeTitle.includes(entry.anime.animeTitle)
                          ? leaf.episode.episodeTitle
                          : entry.anime.animeTitle + ' · ' + leaf.episode.episodeTitle
                      }
                      loader={episodeLoader}
                      disabled={loading}
                      loading={loading && loadingEpisodeKey === danmakuEpisodeCacheKey(leaf)}
                      sameNumber={false}
                      onPress={() => void handleEpisodeSelect(leaf)}
                    />
                  );
                return (
                  <NativeSettingsItem
                    key={entry.key}
                    leading={<SettingsSymbol name="tv" />}
                    title={<SearchTitle>{entry.anime.animeTitle}</SearchTitle>}
                    subtitle={
                      <SettingsSubtitle
                        primary={
                          entry.anime.typeDescription +
                          ' · ' +
                          (entry.anime.episodes.length || entry.anime.episodeCount || 0) +
                          ' 个条目'
                        }
                      />
                    }
                    disclosure
                    onPress={loading ? undefined : () => void handleAnimeSelect(entry)}
                  />
                );
              })}
            </NativeSettingsSection>
          ) : null;
        })}
    </>
  );

  if (showResults) {
    return (
      <NativeSettingsForm hosted surface="sheet" testID="player-danmaku-search-results">
        {seasonOptions.length > 2 ? (
          <NativeSettingsSection>
            <SearchPicker
              title="季度"
              value={season}
              options={seasonOptions}
              onValueChange={setSeason}
            />
          </NativeSettingsSection>
        ) : null}
        {results}
      </NativeSettingsForm>
    );
  }

  return (
    <NativeSettingsForm hosted surface="sheet" testID="player-danmaku-search">
      <NativeSettingsSection title="搜索番剧">
        <Row
          alignment="center"
          spacing={12}
          modifiers={Platform.OS === 'ios' ? [listRowSeparator('hidden', 'all')] : undefined}
        >
          <NativeTextInput
            value={keywordState}
            onChangeText={(value) => {
              cancelPending();
              setKeyword(value);
              setAnimes([]);
              setSeason('all');
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
          <DanmakuSearchButton
            disabled={searchDisabled}
            loading={loading}
            onPress={() => void handleSearch()}
          />
        </Row>
      </NativeSettingsSection>
      <NativeSettingsSection footer={playingContext}>
        <NativeSettingsItem
          title={<SettingsTitle>搜索范围</SettingsTitle>}
          subtitle={
            <SettingsSubtitle
              primary={
                sources
                  .filter((source) => apiIds.includes(source.id))
                  .map((source) => source.name)
                  .join('、') || '请至少选择一个 API'
              }
              lines={2}
            />
          }
          disclosure
          onPress={() => {
            cancelPending();
            setEditingSources(true);
          }}
        />
      </NativeSettingsSection>
      {errorSection}
      {animes.length ? (
        <NativeSettingsSection>
          <NativeSettingsItem
            title={
              <SettingsTitle>{'查看上次结果 · ' + animes.length + ' 个季度 / 版本'}</SettingsTitle>
            }
            disclosure
            onPress={() => setShowResults(true)}
          />
        </NativeSettingsSection>
      ) : null}
    </NativeSettingsForm>
  );
}
