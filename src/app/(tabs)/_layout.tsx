import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useConnectionStore } from '@/src/core/connection/store';

export default function TabsLayout() {
  const { t } = useTranslation();
  const status = useConnectionStore((s) => s.status);
  const permissions = useConnectionStore((s) => s.permissions);

  if (status !== 'connected') return <Redirect href="/connect" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#101014', borderTopColor: '#2e2e2e' },
        tabBarActiveTintColor: '#7dd3fc',
        tabBarInactiveTintColor: '#a1a1aa',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarLabel: t('tabs.remote') }} />
      <Tabs.Screen
        name="queue"
        options={{
          tabBarLabel: t('tabs.queue'),
          href: permissions?.player ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="presentation"
        options={{
          tabBarLabel: t('tabs.presentation'),
          href: permissions?.presentation ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarLabel: t('tabs.chat'),
          href: permissions?.chat ? undefined : null,
        }}
      />
    </Tabs>
  );
}
