import { useThemeColor } from '@/hooks/useThemeColor';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { HeaderButton } from 'expo-router/react-navigation';

export default function HeaderBackButton({ canGoBack = true }: { canGoBack?: boolean }) {
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const router = useRouter();

  if (!canGoBack) {
    return null;
  }

  return (
    <HeaderButton
      onPress={() => router.back()}
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
      }}
    >
      <Ionicons name="chevron-back" size={24} color={textColor} />
    </HeaderButton>
  );
}
