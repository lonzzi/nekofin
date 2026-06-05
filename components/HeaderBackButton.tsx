import { useAppTheme } from '@/lib/design-system';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { HeaderButton } from 'expo-router/react-navigation';

export default function HeaderBackButton({ canGoBack = true }: { canGoBack?: boolean }) {
  const theme = useAppTheme();
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
      <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
    </HeaderButton>
  );
}
