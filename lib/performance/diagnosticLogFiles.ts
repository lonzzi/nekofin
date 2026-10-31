import { Directory, Paths } from 'expo-file-system';

export const diagnosticLogDirectory = () => new Directory(Paths.cache, 'nekofin/diagnostics');

export function clearDiagnosticLogFiles() {
  const directory = diagnosticLogDirectory();
  if (directory.exists) directory.delete();
}

export function diagnosticLogFileBytes() {
  const directory = diagnosticLogDirectory();
  return directory.exists ? (directory.size ?? 0) : 0;
}
