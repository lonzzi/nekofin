function isPerformanceDiagnosticsEnabled() {
  if (process.env.NEKOFIN_ENABLE_PERFORMANCE_MONITOR === '1') {
    return true;
  }

  if (process.env.NEKOFIN_ENABLE_PERFORMANCE_MONITOR === '0') {
    return false;
  }

  if (process.env.APP_VARIANT === 'development') {
    return true;
  }

  if (process.env.APP_VARIANT === 'preview' || process.env.APP_VARIANT === 'production') {
    return false;
  }

  return process.env.NODE_ENV !== 'production';
}

module.exports = {
  isPerformanceDiagnosticsEnabled,
};
