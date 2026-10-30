import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { redactDiagnosticText } from './diagnosticReport';

export async function readNativeDiagnosticLogs() {
  if (Platform.OS !== 'android') return 'Raw native log collection is available on Android.';
  try {
    const module = requireOptionalNativeModule<{ readOwnLogAsync: () => Promise<string> }>(
      'DiagnosticLogs',
    );
    if (!module)
      return 'Native collector unavailable in this build; rebuild the app to include it.';
    const text = await module.readOwnLogAsync();
    return redactDiagnosticText(text || 'The own-process log buffer is empty.');
  } catch (error) {
    return redactDiagnosticText(
      `Native logs unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
