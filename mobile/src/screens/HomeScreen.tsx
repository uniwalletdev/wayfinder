import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { COLORS } from '../constants/colors';
import { supabase } from '../services/supabase';
import { Location } from '../types';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

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
    const { data } = await supabase
      .from('locations')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(8);
    setSearchResults((data as Location[]) ?? []);
    setIsSearching(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Wayfinder</Text>
        <Text style={styles.subtitle}>Hospital Navigation</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Where do you need to go?"
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {isSearching && <ActivityIndicator style={styles.searchSpinner} color={COLORS.primary} />}
      </View>

      {searchResults.length > 0 ? (
        <ScrollView style={styles.results}>
          {searchResults.map((loc) => (
            <TouchableOpacity
              key={loc.id}
              style={styles.resultItem}
              onPress={() => navigation.navigate('Destination', { locationId: loc.id })}
            >
              <Text style={styles.resultName}>{loc.name}</Text>
              <Text style={styles.resultType}>{loc.type}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.qrButton}
            onPress={() => navigation.navigate('QRScanner')}
          >
            <Text style={styles.qrButtonText}>📷  Scan QR Code</Text>
            <Text style={styles.qrButtonSub}>Scan the code at the hospital entrance</Text>
          </TouchableOpacity>

          <View style={styles.amenities}>
            <Text style={styles.amenitiesTitle}>Nearby</Text>
            {(['bathroom', 'cafe', 'pharmacy'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.amenityButton}
                onPress={() => handleSearch(type)}
              >
                <Text style={styles.amenityText}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
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
  header: { padding: 24, paddingBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 16, color: COLORS.textMuted, marginTop: 4 },
  searchContainer: { marginHorizontal: 16, marginBottom: 8, position: 'relative' },
  searchInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  searchSpinner: { position: 'absolute', right: 16, top: 18 },
  results: { flex: 1, marginHorizontal: 16 },
  resultItem: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  resultType: { fontSize: 13, color: COLORS.textMuted, marginTop: 2, textTransform: 'capitalize' },
  actions: { flex: 1, padding: 16 },
  qrButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
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
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  amenityText: { fontSize: 15, color: COLORS.text, textTransform: 'capitalize' },
});
