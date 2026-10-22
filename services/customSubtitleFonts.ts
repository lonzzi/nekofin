import { t as tr } from '@/lib/i18n';
import { storage } from '@/lib/storage';
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { decodeWoff2, fontFamilies } from 'expo-mpv';

import { SUBTITLE_FONT_MAX_BYTES } from './media/subtitleFonts';

export const CUSTOM_SUBTITLE_FONTS_KEY = 'playback.customSubtitleFonts';
export const CUSTOM_SUBTITLE_FONTS_PATH = 'nekofin/custom-subtitle-fonts/v1';
export type CustomSubtitleFont = {
  id: string;
  name: string;
  extension: string;
  families: string[];
  size: number;
};
export type SubtitleFontSelection = { id: string; family: string };
export type CustomSubtitleFonts = {
  fonts: CustomSubtitleFont[];
  selection?: SubtitleFontSelection;
};
const root = () => new Directory(Paths.document, CUSTOM_SUBTITLE_FONTS_PATH);
function checkAborted(signal: AbortSignal) {
  if (signal.aborted) throw new Error(tr('fonts.importCanceled'));
}

export function parseCustomSubtitleFonts(value?: string): CustomSubtitleFonts {
  try {
    const data = JSON.parse(value ?? '');
    const fonts: CustomSubtitleFont[] = data.fonts.filter(
      (font: CustomSubtitleFont) =>
        font &&
        typeof font.id === 'string' &&
        /^[a-zA-Z0-9-]{1,64}$/.test(font.id) &&
        typeof font.name === 'string' &&
        /^(ttf|otf|ttc|woff)$/.test(font.extension) &&
        Number.isFinite(font.size) &&
        font.size > 0 &&
        font.size <= SUBTITLE_FONT_MAX_BYTES &&
        Array.isArray(font.families) &&
        font.families.length > 0 &&
        font.families.length <= 64 &&
        font.families.every(
          (name) => typeof name === 'string' && !!name.trim() && !/[\x00-\x1f\x7f]/.test(name),
        ),
    );
    const selection = fonts.some(
      (font) => font.id === data.selection?.id && font.families.includes(data.selection?.family),
    )
      ? { id: data.selection.id, family: data.selection.family }
      : undefined;
    return { fonts, selection };
  } catch {
    return { fonts: [] };
  }
}
const read = () => parseCustomSubtitleFonts(storage.getString(CUSTOM_SUBTITLE_FONTS_KEY));
const save = (settings: CustomSubtitleFonts) =>
  storage.set(CUSTOM_SUBTITLE_FONTS_KEY, JSON.stringify(settings));

export function customSubtitleFontFile(font: CustomSubtitleFont) {
  return new File(root(), `${font.id}.${font.extension}`);
}

export function selectCustomSubtitleFont(selection?: SubtitleFontSelection) {
  const settings = read();
  if (
    selection &&
    !settings.fonts.some(
      (font) => font.id === selection.id && font.families.includes(selection.family),
    )
  )
    return;
  save({ ...settings, selection });
}

export function removeCustomSubtitleFont(id: string) {
  const settings = read();
  const font = settings.fonts.find((font) => font.id === id);
  save({
    fonts: settings.fonts.filter((font) => font.id !== id),
    selection: settings.selection?.id === id ? undefined : settings.selection,
  });
  if (font) {
    const file = customSubtitleFontFile(font);
    if (file.exists) file.delete();
  }
}

export function normalizeFontUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw 0;
    url.hash = '';
    return url.toString();
  } catch {
    throw new Error(tr('fonts.httpUrlRequired'));
  }
}

function extension(file: File) {
  if (!file.exists || file.size < 12 || file.size > SUBTITLE_FONT_MAX_BYTES)
    throw new Error(tr('fonts.emptyOrOversizedFile'));
  const handle = file.open();
  try {
    const signature = [...handle.readBytes(4)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const format = {
      '00010000': 'ttf',
      '74727565': 'ttf',
      '4f54544f': 'otf',
      '74746366': 'ttc',
      '774f4646': 'woff',
      '774f4632': 'woff2',
    }[signature];
    if (!format) throw new Error(tr('fonts.chooseSupportedFile'));
    return format;
  } finally {
    handle.close();
  }
}

async function downloadFont(
  url: string,
  file: File,
  signal: AbortSignal,
  headers?: Record<string, string>,
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  let oversized = false;
  try {
    checkAborted(signal);
    await File.downloadFileAsync(url, file, {
      headers,
      signal: controller.signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (bytesWritten > SUBTITLE_FONT_MAX_BYTES || totalBytes > SUBTITLE_FONT_MAX_BYTES) {
          oversized = true;
          controller.abort();
        }
      },
    });
    if (oversized) throw new Error(tr('fonts.fileSizeLimit'));
  } catch {
    if (oversized) throw new Error(tr('fonts.fileSizeLimit'));
    checkAborted(signal);
    throw new Error(tr('fonts.downloadFailed'));
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

export async function importCustomSubtitleFont(input: {
  uri: string;
  name?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}) {
  if (read().fonts.length >= 32) throw new Error(tr('fonts.fontCountLimit'));
  const directory = root();
  directory.create({ intermediates: true, idempotent: true });
  const id = randomUUID();
  const partial = new File(directory, `${id}.part`);
  const decoded = new File(directory, `${id}.decoded`);
  const controller = new AbortController();
  const abort = () => controller.abort();
  input.signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 60_000);
  let destination: File | undefined;
  let committed = false;
  try {
    if (input.signal?.aborted) controller.abort();
    checkAborted(controller.signal);
    if (/^(file|content):\/\//.test(input.uri)) {
      const source = new File(input.uri);
      if (source.size > SUBTITLE_FONT_MAX_BYTES) throw new Error(tr('fonts.fileSizeLimit'));
      await source.copy(partial);
    } else {
      await downloadFont(normalizeFontUrl(input.uri), partial, controller.signal, input.headers);
    }
    checkAborted(controller.signal);
    const format = extension(partial);
    if (format === 'woff2') {
      try {
        await decodeWoff2(partial.uri, decoded.uri);
      } catch {
        throw new Error(tr('fonts.invalidFontFile'));
      }
    }
    const canonical = format === 'woff2' ? decoded : partial;
    const canonicalFormat = extension(canonical);
    let families: string[];
    try {
      families = await fontFamilies(canonical.uri);
    } catch {
      throw new Error(tr('fonts.invalidFontFile'));
    }
    checkAborted(controller.signal);
    const font: CustomSubtitleFont = {
      id,
      name: input.name?.split(/[\\/]/).at(-1)?.slice(0, 200) || families[0],
      extension: canonicalFormat,
      families,
      size: canonical.size,
    };
    destination = customSubtitleFontFile(font);
    await canonical.move(destination);
    checkAborted(controller.signal);
    save({ fonts: [...read().fonts, font], selection: { id, family: families[0] } });
    committed = true;
    return font;
  } catch (error) {
    if (controller.signal.aborted && !input.signal?.aborted)
      throw new Error(tr('fonts.importTimedOut'));
    throw error;
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', abort);
    for (const file of [
      new File(directory, `${id}.part`),
      new File(directory, `${id}.decoded`),
      ...(!committed && destination ? [destination] : []),
    ])
      if (file.exists) file.delete();
  }
}
