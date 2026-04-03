import fs from 'fs';
import path from 'path';
import { ConfigPlugin, withDangerousMod } from '@expo/config-plugins';

/**
 * Expo config plugin that injects a post_install hook into the Podfile
 * to force all pods to use the project's minimum iOS deployment target.
 *
 * This fixes build failures caused by old pods (e.g. Mute 0.6.1 targeting iOS 9.0)
 * that are incompatible with newer Xcode versions (Xcode 26+ requires >= 12.0).
 */
const withMinDeploymentTarget: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      try {
        let contents = fs.readFileSync(podfilePath, 'utf8');

        // Don't add if already patched
        if (contents.includes('Fix pods with outdated deployment targets')) {
          console.log('✅ Podfile already patched for deployment target, skipping');
          return config;
        }

        // Inject deployment target fix into the existing post_install block,
        // right after the react_native_post_install call
        const postInstallPatch = `
    # Fix pods with outdated deployment targets (e.g. Mute pod targeting iOS 9.0)
    # that are incompatible with newer Xcode versions (Xcode 26+ requires >= 12.0)
    min_deployment_target = podfile_properties['ios.deploymentTarget'] || '15.1'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current && Gem::Version.new(current) < Gem::Version.new(min_deployment_target)
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_deployment_target
        end
      end
    end`;

        // Insert the deployment target fix before the closing `end` of the post_install block.
        // The Podfile structure is:
        //   post_install do |installer|
        //     react_native_post_install(...)
        //   end            <-- we insert before this
        // end
        //
        // We look for the end of the react_native_post_install(...) call's closing parenthesis
        // that is followed by the post_install `end` keyword, and insert between them.

        // Find "post_install do |installer|" ... "end" and insert before the inner "end"
        const postInstallRegex = /(post_install\s+do\s+\|installer\|[\s\S]*?)(^\s{2}end)/m;
        const postInstallMatch = contents.match(postInstallRegex);

        if (postInstallMatch) {
          contents = contents.replace(
            postInstallRegex,
            `${postInstallMatch[1]}\n${postInstallPatch}\n$2`,
          );
          fs.writeFileSync(podfilePath, contents);
          console.log('✅ Successfully patched Podfile with deployment target fix');
        } else {
          console.warn('⚠️ Could not find react_native_post_install in Podfile, skipping patch');
        }
      } catch (error) {
        console.warn('⚠️ Failed to patch Podfile:', error);
      }

      return config;
    },
  ]);
};

export default withMinDeploymentTarget;
