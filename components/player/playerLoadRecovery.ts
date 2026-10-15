// A failed open can be transient (expired playback session, connection reset,
// or an HLS manifest that is not ready yet). Renegotiate once, then let the user
// retry explicitly. Other mpv failures must not enter an automatic retry loop.
export function createPlayerLoadRecovery() {
  let automaticRetryUsed = false;
  let selection: string | undefined;
  return {
    claimAutomaticRetry(message: string, selectionKey: string) {
      if (selection !== selectionKey) {
        selection = selectionKey;
        automaticRetryUsed = false;
      }
      if (automaticRetryUsed || !/\(code -13\)\s*$/.test(message)) return false;
      automaticRetryUsed = true;
      return true;
    },
  };
}

export function playbackFailureMessage(message: string) {
  const code = /\(code (-?\d+)\)/.exec(message)?.[1];
  return `无法读取视频${code ? `（错误 ${code}）` : ''}。请重新加载；若仍失败，请检查服务器连接或切换视频版本。`;
}
