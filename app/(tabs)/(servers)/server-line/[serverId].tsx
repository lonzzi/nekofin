import { HeaderActionProgress } from '@/components/navigation/HeaderActionProgress';
import { HeaderButton, HeaderToolbar } from '@/components/navigation/HeaderToolbar';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import { ServerFormButton } from '@/components/servers/ServerFormButton';
import { ServerFormField, ServerFormSection } from '@/components/servers/ServerFormControls';
import { ServerFormScrollView } from '@/components/servers/ServerFormScrollView';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useTranslation } from '@/lib/i18n';
import { buildConnectionAddress } from '@/lib/serverConnection';
import { getServerConnections } from '@/lib/serverConnections';
import { layout, useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { toast } from '@/lib/toast';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Platform, Text } from 'react-native';

type PendingAction = 'save' | 'switch' | 'remove';

function ServerLineScreen() {
  const { t: tr } = useTranslation();
  const { serverId, connectionId } = useLocalSearchParams<{
    serverId: string;
    connectionId?: string;
  }>();
  const { getServer, saveConnection, switchConnection, removeConnection } = useMediaServers();
  const server = getServer(serverId);
  const line = server
    ? getServerConnections(server).find((line) => line.id === connectionId)
    : undefined;
  const [name, setName] = useState(line?.name ?? '');
  const [address, setAddress] = useState(line?.address ?? '');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const busy = pending !== null;
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const theme = useAppTheme();
  const router = useRouter();
  const active = !!line && line.address === server?.address;
  const missing = !server || (!!connectionId && !line);
  const run = async (key: PendingAction, action: () => Promise<void>) => {
    if (busyRef.current || missing) return;
    busyRef.current = true;
    setPending(key);
    setError('');
    try {
      await action();
      router.back();
      toast.success(
        key === 'remove'
          ? tr('server.connectionDeleted')
          : key === 'switch'
            ? tr('server.connectionSwitched')
            : tr('server.connectionSaved'),
      );
    } catch (error) {
      toast.error(tr('server.connectionOperationFailed'), {
        description:
          error instanceof Error ? error.message : tr('server.connectionFailedUrlAndNetwork'),
      });
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  };
  const save = () => {
    try {
      buildConnectionAddress(address);
    } catch (error) {
      setError(error instanceof Error ? error.message : tr('server.checkUrl'));
      return;
    }
    void run('save', () => saveConnection(serverId, name, address, connectionId));
  };
  return (
    <>
      <OuterScreenOptions
        title={connectionId ? tr('server.editConnection') : tr('server.addConnection')}
        large={false}
        grouped
      />
      <HeaderToolbar placement="right">
        {pending === 'save' ? (
          Platform.OS === 'ios' ? (
            <Stack.Toolbar.View>
              <HeaderActionProgress label={tr('server.verifyingAndSavingConnection')} />
            </Stack.Toolbar.View>
          ) : (
            <HeaderActionProgress label={tr('server.verifyingAndSavingConnection')} />
          )
        ) : (
          <HeaderButton
            icon={getNativeToolbarIcon('save', 'checkmark')}
            accessibilityLabel={tr('server.saveConnection')}
            disabled={busy || missing || !address.trim()}
            onPress={save}
            variant="done"
          >
            {tr('common.save')}
          </HeaderButton>
        )}
      </HeaderToolbar>
      <ServerFormScrollView
        maxContentWidth={layout.formMaxWidth}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, gap: 24 }}
        style={{ backgroundColor: theme.colors.backgroundGrouped }}
      >
        <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
          {missing ? tr('server.connectionNoLongerExists') : `${server.name} · ${server.username}`}
        </Text>
        {!missing ? (
          <ServerFormSection footer={tr('server.connectionUrlHint')}>
            <ServerFormField
              label={tr('server.connectionName')}
              placeholder={tr('server.connectionNamePlaceholder')}
              defaultValue={name}
              onChangeText={setName}
              editable={!busy}
            />
            <ServerFormField
              label={tr('server.connectionUrl')}
              placeholder="https://media.example.com:8097"
              defaultValue={address}
              onChangeText={(value) => {
                setAddress(value);
                setError('');
              }}
              keyboardType="url"
              autoComplete="url"
              textContentType="URL"
              editable={!busy}
            />
          </ServerFormSection>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>
            {error}
          </Text>
        ) : null}
        {line ? (
          <>
            <ServerFormButton
              title={
                pending === 'switch'
                  ? tr('server.connecting')
                  : active
                    ? tr('server.currentConnection')
                    : tr('server.useConnection')
              }
              variant="text"
              color={theme.colors.tint}
              busy={pending === 'switch'}
              disabled={busy || active}
              onPress={() => void run('switch', () => switchConnection(serverId, line.id))}
            />
            <ServerFormButton
              title={
                pending === 'remove' ? tr('common.deletingProgress') : tr('server.deleteConnection')
              }
              variant="text"
              color={theme.colors.danger}
              busy={pending === 'remove'}
              disabled={busy || active}
              onPress={() =>
                Alert.alert(tr('server.deleteConnectionConfirmation'), line.name, [
                  { text: tr('common.cancel'), style: 'cancel' },
                  {
                    text: tr('common.delete'),
                    style: 'destructive',
                    onPress: () => void run('remove', () => removeConnection(serverId, line.id)),
                  },
                ])
              }
            />
            {active ? (
              <Text style={[theme.typography.footnote, { color: theme.colors.textSecondary }]}>
                {tr('server.cannotDeleteActiveConnection')}
              </Text>
            ) : null}
          </>
        ) : null}
      </ServerFormScrollView>
    </>
  );
}
export default withOuterTheme(ServerLineScreen);
