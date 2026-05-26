import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useNavigation } from '../hooks/useNavigation';
import { useVoiceGuidance } from '../hooks/useVoiceGuidance';
import { COLORS } from '../constants/colors';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Navigation'> };

const { width, height } = Dimensions.get('window');

export default function NavigationScreen({ navigation }: Props) {
  const { state, advanceStep, endNavigation, toggleAccessibility, toggleVoice } = useNavigation();
  const { currentRoute, currentStep, isVoiceEnabled, isAccessibilityMode, destination } = state;

  const instructions = useMemo(
    () => currentRoute?.instructions ?? [],
    [currentRoute]
  );

  useVoiceGuidance(isVoiceEnabled, currentStep, instructions);

  const currentInstruction = instructions[currentStep];
  const totalSteps = instructions.length;
  const progress = totalSteps > 0 ? (currentStep + 1) / totalSteps : 0;
  const remainingTime = currentRoute
    ? Math.max(0, Math.ceil(((1 - progress) * currentRoute.estimated_time_seconds) / 60))
    : 0;

  const isLastStep = currentStep >= totalSteps - 1;

  useEffect(() => {
    if (isLastStep && totalSteps > 0) {
      setTimeout(() => {
        endNavigation();
        navigation.navigate('Home');
      }, 3000);
    }
  }, [isLastStep, totalSteps]);

  return (
    <View style={styles.container}>
      {/* Map placeholder — replace with actual floor plan renderer */}
      <View style={styles.mapArea}>
        <Text style={styles.mapPlaceholder}>Floor Plan Map</Text>
        <Text style={styles.mapSubtext}>(Connects to floor plan image + route overlay)</Text>
      </View>

      {/* Top instruction banner */}
      <SafeAreaView style={styles.bannerContainer} edges={['top']}>
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {currentInstruction?.text ?? 'Follow the route on the map'}
          </Text>
          {currentInstruction?.landmark && (
            <Text style={styles.bannerLandmark}>at {currentInstruction.landmark}</Text>
          )}
        </View>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </SafeAreaView>

      {/* Bottom controls */}
      <SafeAreaView style={styles.bottomContainer} edges={['bottom']}>
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>
            {isLastStep ? 'Arrived!' : `~${remainingTime} min remaining`}
          </Text>
          <Text style={styles.stepCounter}>
            Step {Math.min(currentStep + 1, totalSteps)} of {totalSteps}
          </Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, isAccessibilityMode && styles.controlButtonActive]}
            onPress={toggleAccessibility}
          >
            <Text style={styles.controlIcon}>♿</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.nextButton}
            onPress={isLastStep ? () => { endNavigation(); navigation.navigate('Home'); } : advanceStep}
          >
            <Text style={styles.nextButtonText}>{isLastStep ? 'Done' : 'Next →'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, !isVoiceEnabled && styles.controlButtonMuted]}
            onPress={toggleVoice}
          >
            <Text style={styles.controlIcon}>{isVoiceEnabled ? '🔊' : '🔇'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mapArea: {
    flex: 1,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholder: { fontSize: 20, fontWeight: '700', color: COLORS.textMuted },
  mapSubtext: { fontSize: 13, color: COLORS.textMuted, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  banner: {
    backgroundColor: COLORS.primary,
    margin: 12,
    borderRadius: 14,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  bannerText: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  bannerLandmark: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 12,
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: COLORS.success,
    borderRadius: 2,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    elevation: 12,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  timeLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  stepCounter: { fontSize: 14, color: COLORS.textMuted },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  controlButtonActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  controlButtonMuted: { opacity: 0.5 },
  controlIcon: { fontSize: 22 },
  nextButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
});
