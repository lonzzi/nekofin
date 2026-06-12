import { useAppTheme } from '@/lib/design-system';
import type { MediaServerType } from '@/services/media/types';
import {
  Button as SwiftButton,
  Host as SwiftHost,
  Image as SwiftImage,
  Label as SwiftLabel,
  Menu as SwiftMenu,
  Text as SwiftText,
} from '@expo/ui/swift-ui';
import { background, font, foregroundStyle, padding, shapes } from '@expo/ui/swift-ui/modifiers';

type AddServerMenuProps = {
  onSelect: (serverType: MediaServerType) => void;
  variant?: 'icon' | 'text';
};

export function AddServerMenu({ onSelect, variant = 'icon' }: AddServerMenuProps) {
  const theme = useAppTheme();
  const label =
    variant === 'text' ? (
      <SwiftText
        modifiers={[
          font({ size: 15, weight: 'semibold' }),
          foregroundStyle(theme.colors.tint),
          padding({ horizontal: 16, vertical: 9 }),
          background(theme.colors.surfaceMuted, shapes.capsule()),
        ]}
      >
        添加服务器
      </SwiftText>
    ) : (
      <SwiftImage
        systemName="plus"
        size={22}
        color={theme.colors.text}
        modifiers={[
          padding({ all: 17 }),
          background(theme.colors.surfaceElevated, shapes.circle()),
        ]}
      />
    );

  return (
    <SwiftHost matchContents>
      <SwiftMenu label={label}>
        <SwiftButton onPress={() => onSelect('jellyfin')}>
          <SwiftLabel title="Jellyfin" icon={<SwiftImage assetName="jellyfin" size={18} />} />
        </SwiftButton>
        <SwiftButton onPress={() => onSelect('emby')}>
          <SwiftLabel title="Emby" icon={<SwiftImage assetName="emby" size={18} />} />
        </SwiftButton>
      </SwiftMenu>
    </SwiftHost>
  );
}
