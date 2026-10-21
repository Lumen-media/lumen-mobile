import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';

import { useConnectionStore } from '@/src/core/connection/store';
import type { QueueItem } from '@/src/core/protocol';
import { formatTime } from '@/src/features/common/format';
import { useQueueStore } from '@/src/features/queue/queue-store';

export default function QueueScreen() {
  const { t } = useTranslation();
  const permissions = useConnectionStore((s) => s.permissions);
  const { items, jump, remove, shuffle, clear } = useQueueStore();

  function confirmClear() {
    Alert.alert(t('queue.clear'), t('queue.confirmClear'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('queue.clear'), style: 'destructive', onPress: () => clear() },
    ]);
  }

  function renderItem({ item, index }: { item: QueueItem; index: number }) {
    return (
      <Pressable
        className={`border-edge flex-row items-center gap-3 border-b px-4 py-3 ${
          item.is_playing ? 'bg-lumen-700/30' : ''
        }`}
        onPress={() => jump(item.id)}
        onLongPress={() => remove(item.id)}
      >
        <Text className="text-muted-foreground w-6 text-center text-sm">{index + 1}</Text>
        <View className="flex-1">
          <Text className="text-foreground text-sm font-medium" numberOfLines={1}>
            {item.title || item.artist || `#${item.id}`}
          </Text>
          {item.artist ? (
            <Text className="text-muted-foreground text-xs" numberOfLines={1}>
              {item.artist}
            </Text>
          ) : null}
        </View>
        {item.is_playing ? (
          <Text className="text-lumen-500 text-xs font-semibold">{t('queue.now')}</Text>
        ) : item.is_played ? (
          <Text className="text-muted-foreground text-xs">{t('queue.played')}</Text>
        ) : item.duration ? (
          <Text className="text-muted-foreground text-xs">{formatTime(item.duration)}</Text>
        ) : null}
      </Pressable>
    );
  }

  if (!permissions?.player) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-muted-foreground text-center text-sm">
          {t('presentation.noPermission')}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="border-edge flex-row items-center justify-between border-b px-4 py-3">
        <Text className="text-foreground text-lg font-bold">{t('queue.title')}</Text>
        <View className="flex-row gap-2">
          <Pressable className="rounded-lg bg-white/10 px-3 py-2" onPress={() => shuffle()}>
            <Text className="text-white text-xs font-semibold">{t('queue.shuffle')}</Text>
          </Pressable>
          <Pressable className="rounded-lg bg-red-500/20 px-3 py-2" onPress={confirmClear}>
            <Text className="text-red-400 text-xs font-semibold">{t('queue.clear')}</Text>
          </Pressable>
        </View>
      </View>
      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground text-sm">{t('queue.empty')}</Text>
        </View>
      ) : (
        <FlashList data={items} keyExtractor={(item) => String(item.id)} renderItem={renderItem} />
      )}
    </View>
  );
}
