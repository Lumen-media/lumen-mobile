import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import '../global.css';

import { GluestackUIProvider } from '@/src/components/ui/gluestack-ui-provider';
import { initDispatch } from '@/src/core/connection/dispatch';
import { connection } from '@/src/core/connection/manager';
import '@/src/i18n';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  useEffect(() => {
    initDispatch();
    void connection.autoConnect();
  }, []);

  return (
    <GluestackUIProvider mode="dark">
      <ThemeProvider value={DarkTheme}>
        <StatusBar style="light" />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="connect" options={{ presentation: 'modal', title: '' }} />
        </Stack>
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
