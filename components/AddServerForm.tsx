import { NativeServerForm } from '@/components/servers/NativeServerForm';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { buildConnectionAddress } from '@/lib/serverConnection';
import { connectToMediaServer } from '@/lib/serverConnections';
import { getMediaAdapter } from '@/services/media';
import type { MediaServerInfo, MediaServerType } from '@/services/media/types';
import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

interface Props {
  existingServer?: MediaServerInfo;
  serverType: MediaServerType;
  onSuccess?: () => void;
}

export function AddServerForm({ serverType, existingServer, onSuccess }: Props) {
  const { addServer, updateServer } = useMediaServers();
  const type = existingServer?.type ?? serverType;
  const [values, setValues] = useState({
    address: existingServer?.address ?? '',
    username: existingServer?.username ?? '',
    password: '',
    name: existingServer?.name ?? '',
    note: existingServer?.note ?? '',
  });
  const [connection, setConnection] = useState<{
    address: string;
    id: string;
    name: string;
    version: string;
  } | null>(null);
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
      if (connection && !values.username.trim()) throw new Error('请输入用户名');
    } catch (error) {
      setError(error instanceof Error ? error.message : '请检查服务器地址');
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
            if (existingServer) await updateServer(existingServer.id, authenticated);
            else await addServer(authenticated);
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
            ? '登录失败，请检查用户名、密码和网络后重试。'
            : error instanceof Error
              ? error.message
              : '连接失败，请检查服务器地址和网络。',
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
      onChangeServer={() => {
        if (busyRef.current) return;
        setConnection(null);
        setError('');
        setValues((previous) => ({ ...previous, password: '' }));
      }}
    />
  );
}
