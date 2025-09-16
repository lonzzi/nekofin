// Reexport the native module. On web, it will be resolved to StrokeTextModule.web.ts
// and on native platforms to StrokeTextModule.ts
export { default } from './src/StrokeTextModule';
export { default as StrokeTextView } from './src/StrokeTextView';
export * from './src/StrokeText.types';
