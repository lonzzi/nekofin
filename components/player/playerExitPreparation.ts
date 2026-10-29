/** One preparation per player route, including repeated back presses. */
export function createPlayerExitPreparation() {
  let prepare: (() => Promise<void>) | undefined;
  let pending: Promise<void> | undefined;
  return {
    register(callback: () => Promise<void>) {
      prepare = callback;
      return () => {
        if (prepare === callback) prepare = undefined;
      };
    },
    prepare() {
      pending ??= Promise.resolve().then(() => prepare?.());
      return pending;
    },
  };
}
