import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { COLORS } from '../constants/colors';
import { api } from '../services/api';
import { Location } from '../types';
import WaveHeader from '../components/WaveHeader';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

const AMENITY_LABELS: Record<string, string> = {
  bathroom: 'Find nearest bathroom',
  cafe: 'Find nearest café',
  pharmacy: 'Find nearest pharmacy',
};

export default function HomeScreen({ navigation }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const data = await api.get<Location[]>(`/api/locations?search=${encodeURIComponent(query)}`);
      setSearchResults(data);
      AccessibilityInfo.announceForAccessibility(
        data.length > 0
          ? `${data.length} results found for ${query}`
          : `No results found for ${query}`
      );
    } catch {
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WaveHeader title="Wayfinder" subtitle="Hospital Navigation" />

      <View
        style={styles.searchContainer}
        accessible={false}
      >
        <TextInput
          style={styles.searchInput}
          placeholder="Where do you need to go?"
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
          accessibilityLabel="Search for a hospital location"
          accessibilityHint="Type a department name, room, or facility to find directions"
          accessibilityRole="search"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {isSearching && (
          <ActivityIndicator
            style={styles.searchSpinner}
            color={COLORS.primary}
            accessibilityLabel="Searching"
          />
        )}
      </View>

      {searchResults.length > 0 ? (
        <ScrollView
          style={styles.results}
          accessibilityRole="list"
          accessibilityLabel={`${searchResults.length} search results`}
        >
          {searchResults.map((loc) => (
            <TouchableOpacity
              key={loc.id}
              style={styles.resultItem}
              onPress={() => navigation.navigate('Destination', { locationId: loc.id })}
              accessibilityRole="button"
              accessibilityLabel={`${loc.name}, ${loc.type.replace('_', ' ')}`}
              accessibilityHint="Double tap to view directions"
              accessible
            >
              <Text style={styles.resultName}>{loc.name}</Text>
              <Text style={styles.resultType} accessibilityElementsHidden>
                {loc.type.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.qrButton}
            onPress={() => navigation.navigate('QRScanner')}
            accessibilityRole="button"
            accessibilityLabel="Scan QR code"
            accessibilityHint="Opens camera to scan the QR code at the hospital entrance and set your starting location"
            accessible
          >
            <Text style={styles.qrButtonText} importantForAccessibility="no">📷  Scan QR Code</Text>
            <Text style={styles.qrButtonSub} accessibilityElementsHidden>
              Scan the code at the hospital entrance
            </Text>
          </TouchableOpacity>

          <View style={styles.amenities}>
            <Text style={styles.amenitiesTitle} accessibilityRole="header">
              Nearby
            </Text>
            {(['bathroom', 'cafe', 'pharmacy'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.amenityButton}
                onPress={() => handleSearch(type)}
                accessibilityRole="button"
                accessibilityLabel={AMENITY_LABELS[type]}
                accessible
              >
                <Text style={styles.amenityText}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchContainer: { marginHorizontal: 16, marginTop: -16, marginBottom: 8, position: 'relative' },
  searchInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    minHeight: 52,
  },
  searchSpinner: { position: 'absolute', right: 16, top: 18 },
  results: { flex: 1, marginHorizontal: 16, marginTop: 8 },
  resultItem: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 56,
    justifyContent: 'center',
  },
  resultName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  resultType: { fontSize: 13, color: COLORS.textMuted, marginTop: 2, textTransform: 'capitalize' },
  actions: { flex: 1, padding: 16, paddingTop: 24 },
  qrButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    minHeight: 88,
    justifyContent: 'center',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  qrButtonText: { fontSize: 22, fontWeight: '700', color: COLORS.white, marginBottom: 4 },
  qrButtonSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  amenities: { marginTop: 8 },
  amenitiesTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  amenityButton: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 52,
    justifyContent: 'center',
  },
  amenityText: { fontSize: 15, color: COLORS.text, textTransform: 'capitalize' },
});
