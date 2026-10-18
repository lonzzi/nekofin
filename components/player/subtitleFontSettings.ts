type FontPlayer = {
  setPropertyString: (name: string, value: string) => Promise<unknown>;
};
type FontSettings = { directory?: string; family?: string };

// MPV string-list values escape each comma with a backslash.
export function fontStyleOverride(family: string) {
  return `FontName=${family.replace(/,/g, '\\,')}`;
}

export function createSubtitleFontController(defaults: {
  directory: string;
  family: string;
  assOverride: string;
}) {
  let queue = Promise.resolve();
  const applied = new WeakMap<FontPlayer, FontSettings & { context?: object; dirty: boolean }>();
  return {
    apply(player: FontPlayer, settings: FontSettings, active: () => boolean, context?: object) {
      queue = queue
        .catch(() => {})
        .then(async () => {
          if (!active() || (settings.family && !settings.directory)) return;
          const previous = applied.get(player);
          const refresh = previous?.dirty || previous?.context !== context;
          if (!previous && !settings.directory) return;
          const set = async (name: string, value: string) => {
            if (!active()) return;
            await player.setPropertyString(name, value);
          };
          let complete = false;
          try {
            if (refresh || settings.directory !== previous?.directory) {
              await set(
                'sub-fonts-dir',
                settings.directory
                  ? decodeURIComponent(settings.directory.replace(/^file:\/\//, ''))
                  : defaults.directory,
              );
            }
            if (refresh || settings.family !== previous?.family) {
              await set('sub-font', settings.family ?? defaults.family);
              await set(
                'sub-ass-style-overrides',
                settings.family ? fontStyleOverride(settings.family) : '',
              );
              await set('sub-ass-override', settings.family ? 'yes' : defaults.assOverride);
            }
            complete = active();
          } finally {
            // Record partial applications too, so the next request can restore every option.
            applied.set(player, { ...settings, context, dirty: !complete });
          }
        });
      return queue;
    },
  };
}
