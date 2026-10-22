import { NativeServerForm } from '@/components/servers/NativeServerForm';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useTranslation } from '@/lib/i18n';
import {
  assertSameServerAccount,
  isSameMediaServer,
  ServerAccountError,
} from '@/lib/serverAccounts';
import { buildConnectionAddress } from '@/lib/serverConnection';
import { connectToMediaServer } from '@/lib/serverConnections';
import { getMediaAdapter } from '@/services/media';
import type { MediaServerInfo, MediaServerType } from '@/services/media/types';
import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

interface Props {
  existingServer?: MediaServerInfo;
  accountServer?: MediaServerInfo;
  serverType: MediaServerType;
  onSuccess?: () => void;
}

export function AddServerForm({ serverType, existingServer, accountServer, onSuccess }: Props) {
  const { t: tr } = useTranslation();
  const { addServer, updateServer } = useMediaServers();
  const source = existingServer ?? accountServer;
  const type = source?.type ?? serverType;
  const [values, setValues] = useState({
    address: source?.address ?? '',
    username: existingServer?.username ?? '',
    password: '',
    name: source?.name ?? '',
    note: existingServer?.note ?? '',
  });
  const [connection, setConnection] = useState<{
    address: string;
    id: string;
    name: string;
    version: string;
  } | null>(
    accountServer
      ? {
          address: accountServer.address,
          id: accountServer.remoteServerId ?? '',
          name: accountServer.name,
          version: '',
        }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState('');
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = async () => {
    if (busyRef.current) return;
    setError('');
    let address: string;
    try {
      address = buildConnectionAddress(values.address);
      if (connection && !values.username.trim()) throw new Error(tr('server.enterUsername'));
    } catch (error) {
      setError(error instanceof Error ? error.message : tr('server.checkUrl'));
      return;
    }
    Keyboard.dismiss();
    busyRef.current = true;
    setBusy(true);
    try {
      if (!connection) {
        const info = await connectToMediaServer(address, type);
        if (!mounted.current) return;
        setConnection(info);
        setValues((previous) => ({ ...previous, address: info.address }));
      } else {
        // Recheck server identity before sending credentials from an account shortcut.
        if (accountServer) {
          const info = await connectToMediaServer(connection.address, type);
          if (!mounted.current) return;
          if (
            !isSameMediaServer(accountServer, {
              type,
              address: info.address,
              remoteServerId: info.id,
            })
          )
            throw new ServerAccountError(tr('server.identityChanged'));
        }
        const params = {
          address: connection.address,
          username: values.username.trim(),
          password: values.password,
          type,
          name: values.name.trim(),
          note: values.note.trim(),
        };
        await getMediaAdapter(type).authenticateAndSaveServer({
          ...params,
          addServer: async (authenticated) => {
            if (!mounted.current) return;
            if (existingServer) {
              assertSameServerAccount(existingServer, authenticated);
              await updateServer(existingServer.id, authenticated);
            } else {
              if (accountServer && !isSameMediaServer(accountServer, authenticated))
                throw new ServerAccountError(tr('server.signInServerMismatch'));
              await addServer({
                ...authenticated,
                ...(accountServer ? { connections: accountServer.connections } : {}),
              });
            }
          },
        });
        if (mounted.current) {
          setValues((previous) => ({ ...previous, password: '' }));
          onSuccess?.();
        }
      }
    } catch (error) {
      if (mounted.current)
        setError(
          connection
            ? error instanceof ServerAccountError
              ? error.message
              : tr('server.signInFailedDescription')
            : error instanceof Error
              ? error.message
              : tr('server.connectionFailedServerUrlAndNetwork'),
        );
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <NativeServerForm
      values={values}
      onChange={(field, value) => {
        setValues((previous) => ({ ...previous, [field]: value }));
        setError('');
      }}
      serverType={type}
      connection={connection}
      busy={busy}
      error={error}
      onSubmit={() => void submit()}
      onChangeServer={
        accountServer
          ? undefined
          : () => {
              if (busyRef.current) return;
              setConnection(null);
              setError('');
              setValues((previous) => ({ ...previous, password: '' }));
            }
      }
    />
  );
}
