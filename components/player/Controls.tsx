import { StyleSheet, View } from 'react-native';

import { BottomControls } from './BottomControls';
import { GestureHandler } from './GestureHandler';
import { LockControls } from './LockControls';
import { BottomOverlayGradient, ContentOverlayScrim, TopOverlayGradient } from './OverlayGradients';
import { DanmakuPanel } from './panels/DanmakuPanel';
import { DanmakuSearchPanel } from './panels/DanmakuSearchPanel';
import { EpisodePanel } from './panels/EpisodePanel';
import { PlayerPanelHost } from './panels/PlayerPanelHost';
import { usePlayer } from './PlayerContext';
import { SeekPreview } from './SeekPreview';
import { TopControls } from './TopControls';

export function Controls() {
  const { playback, controls, panels } = usePlayer();
  const { isLocked, isPanelOpen, showControls } = controls;
  if (!controls.overlaysVisible) return null;

  const panelContent = (() => {
    switch (panels.active?.key) {
      case 'episodes':
        return (
          <EpisodePanel
            currentItemId={playback.currentItem?.id}
            episodes={playback.episodes}
            onSelectEpisode={panels.onEpisodeSelect}
          />
        );
      case 'danmaku':
        return <DanmakuPanel onSearch={panels.onSearch} />;
      case 'danmakuSearch':
        return (
          <DanmakuSearchPanel
            ref={panels.searchRef}
            onCommentsLoaded={panels.onCommentsLoaded}
            onLoaded={panels.onDismiss}
            onNavigationChange={panels.onSearchNavigationChange}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <>
      <View
        accessibilityElementsHidden={isPanelOpen}
        importantForAccessibility={isPanelOpen ? 'no-hide-descendants' : 'auto'}
        onLayout={controls.onLayout}
        pointerEvents="box-none"
        style={StyleSheet.absoluteFill}
      >
        <GestureHandler />
        <View
          accessibilityElementsHidden={isLocked || !showControls}
          importantForAccessibility={isLocked || !showControls ? 'no-hide-descendants' : 'auto'}
          pointerEvents={isLocked ? 'none' : 'box-none'}
          style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
        >
          <ContentOverlayScrim />
          <TopOverlayGradient />
          <BottomOverlayGradient />
          <TopControls />
          <BottomControls />
          <SeekPreview />
        </View>
        <LockControls />
      </View>
      <PlayerPanelHost
        onBack={panels.canGoBack ? panels.onBack : undefined}
        onDismiss={panels.onDismiss}
        title={panels.title}
        visible={isPanelOpen}
      >
        {panelContent}
      </PlayerPanelHost>
    </>
  );
}
