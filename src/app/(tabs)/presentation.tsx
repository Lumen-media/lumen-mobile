import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useConnectionStore } from '@/src/core/connection/store';
import { usePresentationStore } from '@/src/features/presentation/presentation-store';

export default function PresentationScreen() {
  const { t } = useTranslation();
  const permissions = useConnectionStore((s) => s.permissions);
  const {
    kind,
    currentDeck,
    slideIndex,
    totalSlides,
    isBlack,
    isWallpaper,
    slideNext,
    slidePrev,
    toggleBlackout,
    toggleWallpaper,
  } = usePresentationStore();

  if (!permissions?.presentation) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-muted-foreground text-center text-sm">
          {t('presentation.noPermission')}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background p-4">
      <Text className="text-foreground text-xl font-bold">
        {currentDeck || kind || t('presentation.title')}
      </Text>
      <Text className="text-muted-foreground mt-1 text-sm">
        {t('presentation.slideOf', { current: slideIndex + 1, total: totalSlides })}
      </Text>

      <View className="mt-8 flex-row items-center justify-center gap-8">
        <Pressable
          className="border-edge bg-surface-raised h-20 w-20 items-center justify-center rounded-2xl border"
          onPress={() => slidePrev()}
        >
          <Text className="text-foreground text-3xl">←</Text>
        </Pressable>
        <Pressable
          className="bg-lumen-600 h-24 w-24 items-center justify-center rounded-full"
          onPress={() => slideNext()}
        >
          <Text className="text-white text-4xl">→</Text>
        </Pressable>
      </View>

      <View className="border-edge bg-surface-raised mt-10 flex-row gap-3 rounded-xl border p-4">
        <Pressable
          className={`flex-1 items-center rounded-lg py-3 ${isBlack ? 'bg-white' : 'bg-white/10'}`}
          onPress={() => toggleBlackout()}
        >
          <Text className={`text-sm font-semibold ${isBlack ? 'text-black' : 'text-white'}`}>
            {t('presentation.blackout')}
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 items-center rounded-lg py-3 ${
            isWallpaper ? 'bg-lumen-600' : 'bg-white/10'
          }`}
          onPress={() => toggleWallpaper()}
        >
          <Text className="text-white text-sm font-semibold">{t('presentation.wallpaper')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
