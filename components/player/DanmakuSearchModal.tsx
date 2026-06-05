import { BottomSheetBackdropModal } from '@/components/BottomSheetBackdropModal';
import { useThemeColor } from '@/hooks/useThemeColor';
import {
  DandanAnime,
  DandanComment,
  DandanEpisode,
  getCommentsByEpisodeId,
  searchAnimesByKeyword,
} from '@/services/dandanplay';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetFlatList, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { ComponentRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

type DanmakuSearchModalProps = {
  onCommentsLoaded: (
    comments: DandanComment[],
    episodeInfo?: { animeTitle: string; episodeTitle: string },
  ) => void;
  ref?: React.RefObject<DanmakuSearchModalRef | null>;
};

type SearchStep = 'anime' | 'episode';

export interface DanmakuSearchModalRef {
  present: () => void;
  dismiss: () => void;
}

export const DanmakuSearchModal = ({ onCommentsLoaded, ref }: DanmakuSearchModalProps) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchStep, setSearchStep] = useState<SearchStep>('anime');
  const [animes, setAnimes] = useState<DandanAnime[]>([]);
  const [episodes, setEpisodes] = useState<DandanEpisode[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<DandanAnime | null>(null);
  const [loading, setLoading] = useState(false);
  const textInputRef = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);

  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const backgroundColor = useThemeColor({ light: '#fff', dark: '#000' }, 'background');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#333' }, 'text');

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const present = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const dismiss = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      present,
      dismiss,
    }),
    [present, dismiss],
  );

  const handleSearch = useCallback(async () => {
    textInputRef.current?.blur();
    if (!searchKeyword.trim()) return;

    setLoading(true);
    try {
      if (searchStep === 'anime') {
        const results = await searchAnimesByKeyword(searchKeyword);
        setAnimes(results);
      } else if (searchStep === 'episode' && selectedAnime) {
        const results = selectedAnime.episodes;
        setEpisodes(results);
      }
    } catch (error) {
      Alert.alert('搜索失败', '请检查网络连接后重试');
    } finally {
      setLoading(false);
    }
  }, [searchKeyword, searchStep, selectedAnime]);

  const handleAnimeSelect = useCallback((anime: DandanAnime) => {
    setSelectedAnime(anime);
    setEpisodes(anime.episodes);
    setSearchStep('episode');
  }, []);

  const handleEpisodeSelect = useCallback(
    async (episode: DandanEpisode) => {
      setLoading(true);
      try {
        const comments = await getCommentsByEpisodeId(episode.episodeId);
        onCommentsLoaded(comments, {
          animeTitle: selectedAnime?.animeTitle ?? '',
          episodeTitle: episode.episodeTitle,
        });
        bottomSheetModalRef.current?.dismiss();
        Alert.alert('成功', '弹幕已加载');
      } catch (error) {
        Alert.alert('加载失败', '无法加载弹幕，请重试');
      } finally {
        setLoading(false);
      }
    },
    [onCommentsLoaded, selectedAnime],
  );

  const handleClose = useCallback(() => {
    setSearchKeyword('');
    setSearchStep('anime');
    setAnimes([]);
    setEpisodes([]);
    setSelectedAnime(null);
  }, []);

  const renderAnimeItem = useCallback(
    ({ item }: { item: DandanAnime }) => (
      <Pressable
        style={[styles.item, { borderBottomColor: borderColor }]}
        onPress={() => handleAnimeSelect(item)}
      >
        <Text style={[styles.itemTitle, { color: textColor }]} numberOfLines={2}>
          {item.animeTitle}
        </Text>
        <Text style={[styles.itemSubtitle, { color: textColor, opacity: 0.6 }]}>
          {item.typeDescription} · {item.episodes.length} 集
        </Text>
      </Pressable>
    ),
    [borderColor, textColor, handleAnimeSelect],
  );

  const renderEpisodeItem = useCallback(
    ({ item }: { item: DandanEpisode }) => (
      <Pressable
        style={[styles.item, { borderBottomColor: borderColor }]}
        onPress={() => handleEpisodeSelect(item)}
      >
        <Text style={[styles.itemTitle, { color: textColor }]} numberOfLines={2}>
          {item.episodeTitle}
        </Text>
      </Pressable>
    ),
    [borderColor, textColor, handleEpisodeSelect],
  );

  const renderEmptyComponent = useCallback(
    () => (
      <Text style={[styles.emptyText, { color: textColor, opacity: 0.6 }]}>
        {searchStep === 'anime' ? (!loading ? '输入番剧名称进行搜索' : '') : '该番剧暂无剧集'}
      </Text>
    ),
    [searchStep, loading, textColor],
  );

  const animeKeyExtractor = useCallback((item: DandanAnime) => item.animeId.toString(), []);
  const episodeKeyExtractor = useCallback((item: DandanEpisode) => item.episodeId.toString(), []);

  return (
    <BottomSheetBackdropModal
      ref={bottomSheetModalRef}
      onDismiss={handleClose}
      snapPoints={['90%']}
      enableDynamicSizing={false}
      enablePanDownToClose={true}
      enableContentPanningGesture={false}
      topInset={30}
      bottomInset={40}
      detached
      style={{ marginHorizontal: 120 }}
    >
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.searchContainer}>
          <BottomSheetTextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                color: textColor,
              },
            ]}
            placeholder={searchStep === 'anime' ? '输入番剧名称' : '剧集列表'}
            placeholderTextColor={`${String(textColor)}80`}
            onChangeText={setSearchKeyword}
            onSubmitEditing={handleSearch}
            editable={searchStep === 'anime'}
            autoCapitalize="none"
            autoCorrect={false}
            ref={textInputRef}
          />
          <Pressable
            style={[
              styles.searchButton,
              !searchKeyword.trim() && styles.disabledButton,
              { backgroundColor: !searchKeyword.trim() ? borderColor : '#007AFF' },
            ]}
            onPress={handleSearch}
            disabled={!searchKeyword.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="search" size={20} color="white" />
            )}
          </Pressable>
        </View>

        {searchStep === 'anime' ? (
          <BottomSheetFlatList
            data={animes}
            renderItem={renderAnimeItem}
            keyExtractor={animeKeyExtractor}
            ListEmptyComponent={renderEmptyComponent}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <BottomSheetFlatList
            data={episodes}
            renderItem={renderEpisodeItem}
            keyExtractor={episodeKeyExtractor}
            ListEmptyComponent={renderEmptyComponent}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </BottomSheetBackdropModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  searchButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  listContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  item: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
});
