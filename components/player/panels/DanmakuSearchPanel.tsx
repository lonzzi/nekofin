import {
  getCommentsByEpisodeId,
  searchAnimesByKeyword,
  type DandanAnime,
  type DandanComment,
  type DandanEpisode,
} from '@/services/dandanplay';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type DanmakuSearchPanelProps = {
  onCommentsLoaded: (
    comments: DandanComment[],
    episodeInfo: { animeTitle: string; episodeTitle: string },
  ) => void;
  onLoaded: () => void;
};

export function DanmakuSearchPanel({ onCommentsLoaded, onLoaded }: DanmakuSearchPanelProps) {
  const [keyword, setKeyword] = useState('');
  const [animes, setAnimes] = useState<DandanAnime[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<DandanAnime | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(
    () => () => {
      requestId.current += 1;
    },
    [],
  );

  const handleSearch = useCallback(async () => {
    const query = keyword.trim();
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
  }, [keyword, loading]);

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

  const renderAnime = useCallback(
    ({ item }: { item: DandanAnime }) => (
      <Pressable
        accessibilityLabel={`${item.animeTitle}，${item.episodes.length} 集`}
        accessibilityRole="button"
        onPress={() => {
          setError(null);
          setSelectedAnime(item);
        }}
        style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
      >
        <View style={styles.resultText}>
          <Text style={styles.resultTitle} numberOfLines={2}>
            {item.animeTitle}
          </Text>
          <Text style={styles.resultSubtitle}>
            {item.typeDescription} · {item.episodes.length} 集
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.42)" />
      </Pressable>
    ),
    [],
  );

  const renderEpisode = useCallback(
    ({ item, index }: { item: DandanEpisode; index: number }) => (
      <Pressable
        accessibilityLabel={item.episodeTitle}
        accessibilityRole="button"
        disabled={loading}
        onPress={() => void handleEpisodeSelect(item)}
        style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
      >
        <View style={styles.episodeIndex}>
          <Text style={styles.episodeIndexText}>{index + 1}</Text>
        </View>
        <Text style={[styles.resultTitle, styles.episodeTitle]} numberOfLines={2}>
          {item.episodeTitle}
        </Text>
        <Ionicons name="arrow-down-circle-outline" size={19} color="#64D2FF" />
      </Pressable>
    ),
    [handleEpisodeSelect, loading],
  );

  const data: (DandanAnime | DandanEpisode)[] = selectedAnime ? selectedAnime.episodes : animes;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={8}
      style={styles.container}
    >
      {selectedAnime ? (
        <Pressable
          accessibilityLabel="返回番剧搜索结果"
          accessibilityRole="button"
          onPress={() => {
            requestId.current += 1;
            setLoading(false);
            setError(null);
            setSelectedAnime(null);
          }}
          style={({ pressed }) => [styles.selectionHeader, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={18} color="#64D2FF" />
          <View style={styles.selectionText}>
            <Text style={styles.selectionEyebrow}>选择剧集</Text>
            <Text style={styles.selectionTitle} numberOfLines={1}>
              {selectedAnime.animeTitle}
            </Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.46)" />
            <TextInput
              accessibilityLabel="番剧名称"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={handleKeywordChange}
              onSubmitEditing={() => void handleSearch()}
              placeholder="输入番剧名称"
              placeholderTextColor="rgba(255,255,255,0.38)"
              returnKeyType="search"
              style={styles.searchInput}
              value={keyword}
            />
          </View>
          <Pressable
            accessibilityLabel="搜索"
            accessibilityRole="button"
            accessibilityState={{ disabled: !keyword.trim() || loading }}
            disabled={!keyword.trim() || loading}
            onPress={() => void handleSearch()}
            style={({ pressed }) => [
              styles.searchButton,
              (!keyword.trim() || loading) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.searchButtonText}>搜索</Text>
            )}
          </Pressable>
        </View>
      )}

      {!!error && (
        <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.feedback}>
          {error}
        </Text>
      )}

      <FlatList
        contentContainerStyle={[styles.listContent, data.length === 0 && styles.emptyList]}
        data={data}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) =>
          'episodeId' in item ? `episode-${item.episodeId}` : `anime-${item.animeId}`
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.emptyState}>
              <Ionicons name="sparkles-outline" size={25} color="rgba(255,255,255,0.32)" />
              <Text style={styles.emptyTitle}>
                {selectedAnime ? '这个条目没有可用剧集' : '搜索番剧后选择对应剧集'}
              </Text>
              {!selectedAnime && <Text style={styles.emptySubtitle}>建议使用正式中文名称</Text>}
            </View>
          ) : null
        }
        renderItem={({ item, index }) =>
          'episodeId' in item ? renderEpisode({ item, index }) : renderAnime({ item })
        }
        showsVerticalScrollIndicator={false}
      />

      {selectedAnime && loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color="#fff" />
          <Text style={styles.loadingText}>正在加载弹幕…</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 9,
    padding: 14,
    paddingBottom: 10,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: '#fff',
    flex: 1,
    fontSize: 14,
    height: 44,
    paddingVertical: 0,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: '#0A84FF',
    borderCurve: 'continuous',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 62,
    paddingHorizontal: 13,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  selectionHeader: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 58,
    paddingHorizontal: 14,
  },
  selectionText: {
    flex: 1,
    gap: 2,
  },
  selectionEyebrow: {
    color: '#64D2FF',
    fontSize: 10,
    fontWeight: '700',
  },
  selectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  feedback: {
    color: '#FF9F0A',
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  listContent: {
    paddingBottom: 24,
    paddingHorizontal: 10,
  },
  emptyList: {
    flexGrow: 1,
  },
  resultRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  resultText: {
    flex: 1,
    gap: 3,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  resultSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
  },
  episodeIndex: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  episodeIndexText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  episodeTitle: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    gap: 7,
    justifyContent: 'center',
    padding: 30,
  },
  emptyTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.34)',
    fontSize: 11,
  },
  loadingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,11,14,0.72)',
    bottom: 0,
    gap: 8,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 58,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.55,
  },
});
