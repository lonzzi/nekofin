# Fix for Chinese Subtitle Display Issue

## Problem
Chinese subtitles were displaying as squares (□□□) instead of proper Chinese characters when playing videos.

## Root Cause
VLC media player on both Android and iOS was not configured with proper font files that support Chinese (CJK) characters. VLC uses the freetype library for text rendering in subtitles, and it needs to be told which font file to use for proper character rendering.

## Solution
Added VLC initialization options to automatically detect and configure system fonts that support CJK characters.

### Android Implementation
Modified: `modules/vlc-player/android/src/main/java/expo/modules/vlcplayer/VlcPlayerView.kt`

The fix tries the following font paths in order:
1. `/system/fonts/NotoSansCJK-Regular.ttc` - Noto Sans CJK (comprehensive CJK support)
2. `/system/fonts/NotoSansHans-Regular.otf` - Noto Sans Simplified Chinese
3. `/system/fonts/DroidSansFallback.ttf` - Legacy fallback font with CJK support
4. `/system/fonts/Roboto-Regular.ttf` - System default font

When a font file is found, it's passed to VLC via the `--freetype-font` initialization option.

### iOS Implementation
Modified: `modules/vlc-player/ios/VlcPlayerView.swift`

The fix tries the following font paths in order:
1. `/System/Library/Fonts/PingFang.ttc` - Modern Chinese font (iOS 9+)
2. `/System/Library/Fonts/STHeiti Medium.ttc` - Legacy Chinese font
3. `/System/Library/Fonts/Helvetica.ttc` - System fallback font

## Technical Details
- The font configuration is added during VLC player initialization
- The code checks for font file existence before adding the option
- First available font is used (no fallback chain needed)
- Debug logging added to track which font is being used

## Testing
To test this fix:
1. Build and install the app on a device
2. Play a video with Chinese subtitles
3. Verify that Chinese characters display correctly instead of squares
4. Check the debug logs to confirm which font was selected

## Expected Behavior
After this fix, Chinese subtitles (and other CJK characters) should render correctly using the system fonts available on the device.
