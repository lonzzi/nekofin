import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import {
  NativeSettingsChoiceList,
  NativeSettingsForm,
  NativeSettingsItem,
  NativeSettingsSection,
} from '@/components/ui/NativeSettings';
import { SettingsActionTitle, SettingsTitle } from '@/components/ui/SettingsVisual';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useTranslation } from '@/lib/i18n';
import { groupServerAccounts, isSameMediaServer } from '@/lib/serverAccounts';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import type { MediaServerInfo } from '@/services/media/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

function ServerAccountsScreen() {
  const { t: tr } = useTranslation();
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { servers, activeServers, selectServerAccount, removeServer } = useMediaServers();
  const router = useRouter();
  const [initialServer] = useState(() => servers.find((account) => account.id === serverId));
  const requestedServer = servers.find((account) => account.id === serverId);
  const accounts =
    groupServerAccounts(servers).find((group) =>
      group.some(
        (account) =>
          account.id === serverId ||
          (!requestedServer && initialServer && isSameMediaServer(account, initialServer)),
      ),
    ) ?? [];
  const active = activeServers.find((account) => accounts.some((item) => item.id === account.id));
  const anchor = active ?? accounts[0];
  const remove = (account: MediaServerInfo) =>
    Alert.alert(
      tr('server.removeAccountConfirmationTitle'),
      tr('server.removeAccountServerUnchangedNote', {
        name: account.name,
        username: account.username,
      }),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        {
          text: tr('common.remove'),
          style: 'destructive',
          onPress: () => {
            const next = accounts.find((item) => item.id !== account.id);
            void removeServer(account.id).then(() => {
              if (!next) router.back();
              else if (account.id === serverId) router.setParams({ serverId: next.id });
            });
          },
        },
      ],
    );
  return (
    <>
      <OuterScreenOptions title={tr('server.accounts')} />
      <NativeSettingsForm testID="server-accounts-form">
        {anchor ? (
          <>
            <NativeSettingsSection
              title={tr('server.switchNamedAccount', { name: anchor.name })}
              footer={tr('server.switchAccountHint')}
            >
              <NativeSettingsChoiceList
                label={tr('server.switchAccount')}
                value={active?.id ?? anchor.id}
                options={accounts.map((account) => ({
                  title: account.username,
                  value: account.id,
                }))}
                onValueChange={(id) => {
                  const account = accounts.find((account) => account.id === id);
                  if (account) selectServerAccount(account);
                }}
              />
              <NativeSettingsItem
                title={
                  <SettingsActionTitle tone="accent">{tr('server.addAccount')}</SettingsActionTitle>
                }
                disclosure
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/(servers)/add-server/[serverType]',
                    params: { serverType: anchor.type, accountServerId: anchor.id },
                  })
                }
              />
            </NativeSettingsSection>
            {accounts.map((account) => (
              <NativeSettingsSection key={account.id} title={account.username}>
                <NativeSettingsItem
                  title={<SettingsTitle>{tr('server.accountSettings')}</SettingsTitle>}
                  disclosure
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/(servers)/server-config/[serverId]',
                      params: { serverId: account.id },
                    })
                  }
                />
                <NativeSettingsItem
                  title={<SettingsActionTitle>{tr('server.removeAccount')}</SettingsActionTitle>}
                  onPress={() => remove(account)}
                />
              </NativeSettingsSection>
            ))}
          </>
        ) : (
          <NativeSettingsSection>
            <NativeSettingsItem title={<SettingsTitle>{tr('server.notFound')}</SettingsTitle>} />
          </NativeSettingsSection>
        )}
      </NativeSettingsForm>
    </>
  );
}

export default withOuterTheme(ServerAccountsScreen);
