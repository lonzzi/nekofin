import { ConfigPlugin, withGradleProperties } from '@expo/config-plugins';

type GradleJvmArgsOptions = {
  jvmArgs?: string;
};

const withGradleJvmArgs: ConfigPlugin<GradleJvmArgsOptions> = (
  config,
  { jvmArgs = '-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8' } = {},
) => {
  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => !('key' in item) || item.key !== 'org.gradle.jvmargs',
    );

    config.modResults.push({
      type: 'property',
      key: 'org.gradle.jvmargs',
      value: jvmArgs,
    });

    return config;
  });
};

export default withGradleJvmArgs;
