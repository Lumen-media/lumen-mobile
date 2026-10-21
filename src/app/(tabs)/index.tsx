import Slider from '@react-native-community/slider';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useConnectionStore } from '@/src/core/connection/store';
import { formatTime } from '@/src/features/common/format';
import { getLivePosition, usePlayerStore } from '@/src/features/player/player-store';
import { useAppPreview } from '@/src/features/preview/use-app-preview';
import { RTCView } from '@/src/features/preview/webrtc';

export default function RemoteScreen() {
  useKeepAwake();
  const { t } = useTranslation();
  const permissions = useConnectionStore((s) => s.permissions);

  const player = usePlayerStore();
  const [livePos, setLivePos] = useState(() => getLivePosition(usePlayerStore.getState()));
  const [seekValue, setSeekValue] = useState<number | null>(null);
  const [volumeValue, setVolumeValue] = useState<number | null>(null);
  const [previewOn, setPreviewOn] = useState(false);
  const preview = useAppPreview(previewOn && (permissions?.streaming ?? false));

  useEffect(() => {
    const id = setInterval(() => setLivePos(getLivePosition(usePlayerStore.getState())), 500);
    return () => clearInterval(id);
  }, []);

  const position = seekValue ?? livePos;
  const volume = volumeValue ?? player.volume;
  const canControl = permissions?.player ?? false;
  const title = player.media?.title || player.media?.url || t('remote.idle');
  const artist = player.media?.artist ?? '';

  return (
    <View className="flex-1 bg-background p-4">
      {permissions?.streaming ? (
        <View className="bg-surface border-edge aspect-video w-full overflow-hidden rounded-xl border">
          {preview.state === 'live' && preview.stream && RTCView ? (
            <RTCView streamURL={preview.stream.toURL()} objectFit="contain" style={{ flex: 1 }} />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-muted-foreground text-sm">
                {preview.state === 'starting'
                  ? t('remote.previewLoading')
                  : preview.state === 'error'
                    ? t('remote.previewError')
                    : t('remote.preview')}
              </Text>
            </View>
          )}
          <Pressable
            className="border-edge absolute right-2 top-2 rounded-lg bg-black/50 px-3 py-1"
            onPress={() => setPreviewOn((v) => !v)}
          >
            <Text className="text-white text-xs">{t('remote.preview')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="mt-6">
        <Text className="text-muted-foreground text-xs uppercase tracking-wide">
          {t('remote.nowPlaying')}
        </Text>
        <Text className="text-foreground mt-1 text-xl font-bold" numberOfLines={1}>
          {title}
        </Text>
        {artist ? (
          <Text className="text-muted-foreground text-sm" numberOfLines={1}>
            {artist}
          </Text>
        ) : null}
      </View>

      <View className="mt-4">
        <Slider
          minimumValue={0}
          maximumValue={player.duration > 0 ? player.duration : 1}
          value={Math.min(position, player.duration || position)}
          minimumTrackTintColor="#7dd3fc"
          maximumTrackTintColor="#3f3f46"
          thumbTintColor="#7dd3fc"
          disabled={!canControl || player.duration <= 0}
          onValueChange={setSeekValue}
          onSlidingComplete={(value) => {
            player.seek(value);
            setSeekValue(null);
          }}
        />
        <View className="flex-row justify-between">
          <Text className="text-muted-foreground text-xs">{formatTime(position)}</Text>
          <Text className="text-muted-foreground text-xs">{formatTime(player.duration)}</Text>
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-center gap-6">
        <Pressable disabled={!canControl} onPress={() => player.previous()}>
          <Text className="text-foreground text-3xl">⏮</Text>
        </Pressable>
        <Pressable
          disabled={!canControl}
          onPress={() => player.playPause()}
          className="bg-lumen-600 h-16 w-16 items-center justify-center rounded-full"
        >
          <Text className="text-white text-2xl">{player.isPlaying ? '⏸' : '▶'}</Text>
        </Pressable>
        <Pressable disabled={!canControl} onPress={() => player.next()}>
          <Text className="text-foreground text-3xl">⏭</Text>
        </Pressable>
      </View>

      <View className="border-edge bg-surface-raised mt-6 gap-3 rounded-xl border p-4">
        <View className="flex-row items-center gap-3">
          <Text className="text-muted-foreground w-6 text-lg">{player.isMuted ? '🔇' : '🔊'}</Text>
          <Slider
            className="flex-1"
            minimumValue={0}
            maximumValue={100}
            value={volume}
            minimumTrackTintColor="#7dd3fc"
            maximumTrackTintColor="#3f3f46"
            thumbTintColor="#7dd3fc"
            disabled={!canControl}
            onValueChange={setVolumeValue}
            onSlidingComplete={(value) => {
              player.setVolume(value);
              setVolumeValue(null);
            }}
          />
          <Pressable disabled={!canControl} onPress={() => player.toggleMute()}>
            <Text className="text-lumen-500 text-xs font-semibold">
              {player.isMuted ? t('remote.unmute') : t('remote.mute')}
            </Text>
          </Pressable>
        </View>
        <View className="flex-row items-center justify-between">
          <Pressable
            disabled={!canControl}
            onPress={() => player.toggleLoop()}
            className={`rounded-lg px-4 py-2 ${player.isLoop ? 'bg-lumen-600' : 'bg-white/10'}`}
          >
            <Text className="text-white text-sm font-semibold">{t('remote.loop')}</Text>
          </Pressable>
          <Pressable disabled={!canControl} onPress={() => player.stop()}>
            <Text className="text-red-400 text-sm font-semibold">■ {t('remote.stop')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
