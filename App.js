import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { PaperProvider } from 'react-native-paper';
import 'react-native-gesture-handler';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import ZoneEstimatorScreen from './src/screens/ZoneEstimatorScreen';
import InvoiceScreen from './src/screens/InvoiceScreen';

const Stack = createStackNavigator();

const theme = {
  colors: {
    primary: '#2563EB',
    primaryLight: '#3B82F6',
    secondary: '#10B981',
    background: '#f5f5f5',
    surface: '#ffffff',
    text: '#1f2937',
    textSecondary: '#6b7280',
    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
  },
};

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <StatusBar style="light" backgroundColor={theme.colors.primary} />
        
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.colors.primary,
            },
            headerTintColor: '#ffffff',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          }}
        >
          <Stack.Screen 
            name="Home" 
            component={HomeScreen}
            options={{
              title: 'Auto Body Estimator',
              headerStyle: {
                backgroundColor: theme.colors.primary,
              },
            }}
          />
          
          <Stack.Screen 
            name="Camera" 
            component={CameraScreen}
            options={{
              title: 'Take Photos',
              headerStyle: {
                backgroundColor: theme.colors.primary,
              },
            }}
          />
          
          <Stack.Screen 
            name="ZoneEstimator" 
            component={ZoneEstimatorScreen}
            options={{
              title: 'Damage Assessment',
              headerStyle: {
                backgroundColor: theme.colors.primary,
              },
            }}
          />
          
          <Stack.Screen 
            name="Invoice" 
            component={InvoiceScreen}
            options={{
              title: 'Generate Invoice',
              headerStyle: {
                backgroundColor: theme.colors.primary,
              },
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}