import { NativeModule, requireNativeModule } from 'expo';

import { StrokeTextModuleEvents } from './StrokeText.types';

declare class StrokeTextModule extends NativeModule<StrokeTextModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<StrokeTextModule>('StrokeText');
