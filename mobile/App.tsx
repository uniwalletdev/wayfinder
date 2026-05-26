import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { NavigationProvider } from './src/context/NavigationContext';
import HomeScreen from './src/screens/HomeScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';
import DestinationScreen from './src/screens/DestinationScreen';
import NavigationScreen from './src/screens/NavigationScreen';
import { COLORS } from './src/constants/colors';

export type RootStackParamList = {
  Home: undefined;
  QRScanner: undefined;
  Destination: { locationId: string };
  Navigation: { routeId: string; destinationId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerStyle: { backgroundColor: COLORS.primary },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
            }}
          >
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: 'Wayfinder', headerShown: false }}
            />
            <Stack.Screen
              name="QRScanner"
              component={QRScannerScreen}
              options={{ title: 'Scan QR Code' }}
            />
            <Stack.Screen
              name="Destination"
              component={DestinationScreen}
              options={{ title: 'Your Destination' }}
            />
            <Stack.Screen
              name="Navigation"
              component={NavigationScreen}
              options={{ title: 'Navigate', headerShown: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </NavigationProvider>
    </SafeAreaProvider>
  );
}
