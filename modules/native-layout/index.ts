import { createModifier } from '@expo/ui/swift-ui/modifiers';
import { requireNativeModule } from 'expo';

export function embeddedNavigationBar() {
  requireNativeModule('NativeLayout');
  return createModifier('nekofinEmbeddedNavigationBar');
}
