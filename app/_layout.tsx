import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <PaperProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="estimates/EstimateFlowDemo" options={{ headerShown: false }} />
          <Stack.Screen name="services/ServiceSettingsScreen" options={{ headerShown: false }} />
          
          <Stack.Screen name="estimation/PhotoSelectScreen" options={{
            title: 'Select Photos',
          }} />
          
          <Stack.Screen name="estimation/TaggingScreen" options={{
            title: 'Tag Damage',
          }} />
          
          <Stack.Screen name="estimation/SummaryScreen" options={{
            title: 'Estimate Summary',
          }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </PaperProvider>
  );
}
