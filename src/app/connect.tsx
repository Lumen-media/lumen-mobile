import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';

import { connection } from '@/src/core/connection/manager';
import { useConnectionStore } from '@/src/core/connection/store';
import { parsePairingQr } from '@/src/core/pairing/parse-pairing-qr';
import { listPaired, type PairedDevice, removePaired } from '@/src/core/secure/devices';
import { connectionError } from '@/src/features/common/connection-error';

export default function ConnectScreen() {
  const { t } = useTranslation();
  const status = useConnectionStore((s) => s.status);
  const error = useConnectionStore((s) => s.error);
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  useEffect(() => {
    void listPaired().then(setDevices);
  }, []);

  useEffect(() => {
    if (status === 'connected') router.replace('/(tabs)');
  }, [status]);

  function onScanned({ data }: { data: string }) {
    if (scannedRef.current) return;
    scannedRef.current = true;
    const target = parsePairingQr(data);
    if (!target) {
      setQrError(t('errors.qrInvalid'));
      scannedRef.current = false;
      return;
    }
    setQrError(null);
    setScanning(false);
    void connection.pair(target.ip, target.port, target.token);
  }

  async function openScanner() {
    setQrError(null);
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    scannedRef.current = false;
    setScanning(true);
  }

  function forget(device: PairedDevice) {
    Alert.alert(device.desktopName, t('common.forget'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.forget'),
        style: 'destructive',
        onPress: () => {
          void removePaired(device.key).then(() => listPaired().then(setDevices));
        },
      },
    ]);
  }

  if (scanning) {
    return (
      <View className="flex-1 bg-black">
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />
        <View className="absolute inset-x-0 bottom-0 items-center gap-2 bg-black/70 p-6">
          <Text className="text-white text-base">{t('connect.scanning')}</Text>
          {qrError ? <Text className="text-red-400 text-sm">{qrError}</Text> : null}
          <Pressable
            className="mt-2 rounded-lg bg-white/15 px-6 py-3"
            onPress={() => setScanning(false)}
          >
            <Text className="text-white font-semibold">{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background p-6">
      <Text className="text-foreground text-2xl font-bold">{t('connect.title')}</Text>
      <Text className="text-muted-foreground mt-1 text-sm">{t('connect.subtitle')}</Text>

      <View className="bg-surface-raised border-edge mt-6 rounded-xl border p-4">
        <Text className="text-foreground font-semibold">{t('connect.paired')}</Text>
        {devices.length === 0 ? (
          <Text className="text-muted-foreground mt-2 text-sm">{t('connect.noDevices')}</Text>
        ) : (
          devices.map((device) => (
            <Pressable
              key={device.key}
              className="border-edge mt-3 flex-row items-center justify-between border-t pt-3"
              onPress={() => connection.connectTo(device)}
              onLongPress={() => forget(device)}
            >
              <View>
                <Text className="text-foreground font-medium">{device.desktopName}</Text>
                <Text className="text-muted-foreground text-xs">
                  {device.host}:{device.port}
                </Text>
              </View>
              <Text className="text-lumen-500 text-sm">{t('common.connect')}</Text>
            </Pressable>
          ))
        )}
      </View>

      {error ? (
        <Text className="text-red-400 mt-4 text-sm">{connectionError(t, error)}</Text>
      ) : (
        <Text className="text-muted-foreground mt-4 text-sm">{t(`connect.status.${status}`)}</Text>
      )}

      <Pressable
        className="bg-primary mt-6 items-center rounded-xl py-4 disabled:opacity-40"
        disabled={status === 'connecting' || status === 'registering'}
        onPress={() => void openScanner()}
      >
        <Text className="text-primary-foreground font-semibold">{t('connect.scanQr')}</Text>
      </Pressable>
      {qrError ? <Text className="text-red-400 mt-3 text-sm">{qrError}</Text> : null}
    </View>
  );
}
