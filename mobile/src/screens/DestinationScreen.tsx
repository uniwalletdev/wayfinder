import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { api } from '../services/api';
import { Location } from '../types';
import { useNavigation } from '../hooks/useNavigation';
import { COLORS } from '../constants/colors';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Destination'>;
  route: RouteProp<RootStackParamList, 'Destination'>;
};

const LOCATION_ICONS: Record<string, string> = {
  department: '🏥',
  bathroom: '🚻',
  cafe: '☕',
  atm: '💳',
  pharmacy: '💊',
  waiting_area: '🪑',
  lift: '🛗',
  reception: '🛎',
  landmark: '📍',
};

export default function DestinationScreen({ navigation, route }: Props) {
  const { locationId } = route.params;
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const { setDestination, startNavigation, state } = useNavigation();

  useEffect(() => {
    api.get<Location>(`/api/locations/${locationId}`)
      .then((data) => {
        if (data) setLocation(data);
        setLoading(false);
      });
  }, [locationId]);

  const handleNavigate = async () => {
    if (!location) return;
    await setDestination(location);
    await startNavigation();
    navigation.navigate('Navigation', {
      routeId: state.currentRoute?.id ?? '',
      destinationId: locationId,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Location not found.</Text>
      </View>
    );
  }

  const icon = LOCATION_ICONS[location.type] ?? '📍';
  const estimatedTime = state.currentRoute
    ? Math.ceil(state.currentRoute.estimated_time_seconds / 60)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{icon}</Text>
        </View>

        <Text style={styles.locationName}>{location.name}</Text>
        <Text style={styles.locationType}>{location.type.replace('_', ' ')}</Text>

        {estimatedTime && (
          <View style={styles.timeChip}>
            <Text style={styles.timeText}>~{estimatedTime} min walk</Text>
          </View>
        )}

        {location.accessibility_features?.length > 0 && (
          <View style={styles.accessibilitySection}>
            <Text style={styles.sectionTitle}>Accessibility</Text>
            {location.accessibility_features.map((feature, i) => (
              <Text key={i} style={styles.accessibilityItem}>✓ {feature}</Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.navigateButton, !state.currentLocation && styles.navigateButtonDisabled]}
          onPress={handleNavigate}
          disabled={!state.currentLocation}
        >
          <Text style={styles.navigateButtonText}>
            {state.currentLocation ? 'Start Navigation' : 'Scan QR Code First'}
          </Text>
        </TouchableOpacity>

        {!state.currentLocation && (
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => navigation.navigate('QRScanner')}
          >
            <Text style={styles.scanButtonText}>Scan Entrance QR Code</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: COLORS.error },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 48 },
  locationName: { fontSize: 26, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  locationType: {
    fontSize: 16,
    color: COLORS.textMuted,
    textTransform: 'capitalize',
    marginTop: 4,
  },
  timeChip: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  timeText: { color: COLORS.primary, fontWeight: '600', fontSize: 15 },
  accessibilitySection: { width: '100%', marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  accessibilityItem: { fontSize: 15, color: COLORS.success, paddingVertical: 3 },
  navigateButton: {
    backgroundColor: COLORS.primary,
    width: '100%',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 32,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  navigateButtonDisabled: { backgroundColor: COLORS.border },
  navigateButtonText: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  scanButton: {
    marginTop: 12,
    padding: 16,
    alignItems: 'center',
  },
  scanButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
});
