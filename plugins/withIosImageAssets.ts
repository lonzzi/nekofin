import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, extname, isAbsolute, join } from 'path';
import { withDangerousMod, type ConfigPlugin } from '@expo/config-plugins';

const withIosImageAssets: ConfigPlugin<string | string[]> = (expoConfig, files) =>
  withDangerousMod(expoConfig, [
    'ios',
    (modConfig) => {
      const iosFiles = Array.isArray(files) ? files : [files];
      const assetCatalogPath = join(
        modConfig.modRequest.platformProjectRoot,
        modConfig.modRequest.projectName ?? 'nekofin',
        'Images.xcassets',
      );

      iosFiles.forEach((file) => {
        const sourceFilePath = isAbsolute(file)
          ? file
          : join(modConfig.modRequest.projectRoot, file);
        const assetName = basename(file, extname(file));
        const imageSetPath = join(assetCatalogPath, `${assetName}.imageset`);
        const assetFileName = basename(file);

        if (!existsSync(imageSetPath)) {
          mkdirSync(imageSetPath, { recursive: true });
        }

        copyFileSync(sourceFilePath, join(imageSetPath, assetFileName));
        writeFileSync(
          join(imageSetPath, 'Contents.json'),
          `${JSON.stringify(
            {
              images: [
                {
                  filename: assetFileName,
                  idiom: 'universal',
                  'preserves-vector-representation': true,
                },
              ],
              info: {
                version: 1,
                author: 'xcode',
              },
            },
            null,
            2,
          )}\n`,
        );
      });

      return modConfig;
    },
  ]);

export default withIosImageAssets;
