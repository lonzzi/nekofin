# Testing Plan for Chinese Subtitle Fix

## Prerequisites
- Android device or emulator (API 21+)
- OR iOS device or simulator (iOS 9+)
- Video file with Chinese subtitles (embedded or external)

## Test Cases

### Test Case 1: Embedded Chinese Subtitles
1. Open a video file that has embedded Chinese subtitles
2. Enable the Chinese subtitle track
3. **Expected Result**: Chinese characters should display correctly
4. **Previous Behavior**: Chinese characters displayed as squares (□□□)

### Test Case 2: External Chinese Subtitles
1. Open a video file
2. Load an external Chinese subtitle file (.srt, .ass, etc.)
3. **Expected Result**: Chinese characters should display correctly
4. **Previous Behavior**: Chinese characters displayed as squares (□□□)

### Test Case 3: Mixed Language Subtitles
1. Open a video with subtitles containing both Chinese and English
2. **Expected Result**: Both Chinese and English characters display correctly
3. **Previous Behavior**: Chinese characters displayed as squares, English was fine

### Test Case 4: Other CJK Languages
1. Test with Japanese subtitles
2. Test with Korean subtitles
3. **Expected Result**: All CJK characters display correctly
4. **Note**: The font configuration should support all CJK characters

## Debug Verification
Check the application logs for font selection messages:

### Android
Look for log messages like:
```
VlcPlayerView: Using font for subtitles: /system/fonts/NotoSansCJK-Regular.ttc
```

### iOS
Look for print statements like:
```
Using font for subtitles: /System/Library/Fonts/PingFang.ttc
```

## Regression Testing
Ensure the fix doesn't break existing functionality:
1. Test English subtitles still work
2. Test subtitle synchronization is not affected
3. Test subtitle switching between tracks
4. Test video playback performance is not degraded

## Platform-Specific Notes

### Android
- Older Android versions might have different font files available
- The fix tries multiple font paths to ensure compatibility
- Most modern Android devices (Android 5.0+) should have NotoSans fonts

### iOS
- iOS 9+ should have PingFang fonts for excellent Chinese support
- Older iOS versions will fall back to STHeiti or Helvetica
- iOS typically has better default CJK font support than Android

## Known Limitations
- The fix requires system fonts to be present on the device
- Custom subtitle fonts specified in .ass files may still require additional configuration
- Font fallback is not chained (uses first available font only)
