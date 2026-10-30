import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { diagnosticLogDirectory } from './diagnosticLogFiles';
import { readNativeDiagnosticLogs } from './nativeDiagnosticLogs';

export async function exportDiagnosticLog(text: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable');
  const directory = diagnosticLogDirectory();
  directory.create({ intermediates: true, idempotent: true });
  // Exports are disposable copies. The persisted capture remains in the diagnostic store.
  for (const entry of directory.list()) {
    if (entry instanceof File && /^nekofin-diagnostics-.*\.log$/.test(entry.name)) entry.delete();
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = new File(directory, `nekofin-diagnostics-${timestamp}.log`);
  const nativeLogs = await readNativeDiagnosticLogs();
  file.write(
    `${text}\n[Recent native logs: current app process, Android device time]\n${nativeLogs}\n`,
  );
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/plain',
    UTI: 'public.plain-text',
    dialogTitle,
  });
  return file.uri;
}
