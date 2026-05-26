import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useNavigation } from '../hooks/useNavigation';
import { useVoiceGuidance } from '../hooks/useVoiceGuidance';
import { COLORS } from '../constants/colors';
import PulsingDot from '../components/PulsingDot';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Navigation'> };

export default function NavigationScreen({ navigation }: Props) {
  const { state, advanceStep, endNavigation, toggleAccessibility, toggleVoice } = useNavigation();
  const { currentRoute, currentStep, isVoiceEnabled, isAccessibilityMode } = state;

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

  // Announce each new instruction to screen readers
  useEffect(() => {
    if (currentInstruction) {
      const msg = currentInstruction.landmark
        ? `${currentInstruction.text} at ${currentInstruction.landmark}`
        : currentInstruction.text;
      AccessibilityInfo.announceForAccessibility(msg);
    }
  }, [currentStep]);

  useEffect(() => {
    if (isLastStep && totalSteps > 0) {
      AccessibilityInfo.announceForAccessibility('You have arrived at your destination');
      const t = setTimeout(() => {
        endNavigation();
        navigation.navigate('Home');
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [isLastStep, totalSteps]);

  const instructionText = currentInstruction?.text ?? 'Follow the route on the map';
  const timeLabel = isLastStep ? 'Arrived!' : `${remainingTime} minute${remainingTime !== 1 ? 's' : ''} remaining`;

  return (
    <View style={styles.container}>
      {/* Map area — replace with actual floor plan renderer */}
      <View
        style={styles.mapArea}
        accessibilityLabel="Hospital floor plan map showing your route"
        accessible
      >
        {/* Pulsing dot for current location */}
        <View style={styles.locationDotWrapper} pointerEvents="none">
          <PulsingDot
            size={22}
            color={COLORS.primary}
            accessibilityLabel="Your current location on the map"
          />
        </View>
        <Text style={styles.mapPlaceholder}>Floor Plan Map</Text>
        <Text style={styles.mapSubtext}>Connects to floor plan image + route overlay</Text>
      </View>

      {/* Top instruction banner — live region so screen readers auto-read updates */}
      <SafeAreaView style={styles.bannerContainer} edges={['top']}>
        <View
          style={styles.banner}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Navigation step ${currentStep + 1} of ${totalSteps}: ${instructionText}${currentInstruction?.landmark ? ` at ${currentInstruction.landmark}` : ''}`}
        >
          <Text style={styles.bannerText} importantForAccessibility="no">
            {instructionText}
          </Text>
          {currentInstruction?.landmark && (
            <Text style={styles.bannerLandmark} importantForAccessibility="no">
              at {currentInstruction.landmark}
            </Text>
          )}
        </View>

        <View
          style={styles.progressBar}
          accessible
          accessibilityLabel={`Route progress: ${Math.round(progress * 100)} percent complete`}
          accessibilityRole="progressbar"
        >
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
      </SafeAreaView>

      {/* Bottom controls */}
      <SafeAreaView style={styles.bottomContainer} edges={['bottom']}>
        <View style={styles.timeRow}>
          <Text
            style={styles.timeLabel}
            accessibilityLiveRegion="polite"
            accessibilityLabel={timeLabel}
          >
            {isLastStep ? 'Arrived! 🎉' : `~${remainingTime} min remaining`}
          </Text>
          <Text style={styles.stepCounter} accessibilityElementsHidden>
            Step {Math.min(currentStep + 1, totalSteps)} of {totalSteps}
          </Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, isAccessibilityMode && styles.controlButtonActive]}
            onPress={toggleAccessibility}
            accessibilityRole="switch"
            accessibilityLabel="Wheelchair accessible route"
            accessibilityState={{ checked: isAccessibilityMode }}
            accessible
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.controlIcon}>♿</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.nextButton}
            onPress={
              isLastStep
                ? () => { endNavigation(); navigation.navigate('Home'); }
                : advanceStep
            }
            accessibilityRole="button"
            accessibilityLabel={isLastStep ? 'Done, return to home' : `Next step: step ${currentStep + 2} of ${totalSteps}`}
            accessible
          >
            <Text style={styles.nextButtonText}>{isLastStep ? 'Done' : 'Next →'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, !isVoiceEnabled && styles.controlButtonMuted]}
            onPress={toggleVoice}
            accessibilityRole="switch"
            accessibilityLabel="Voice guidance"
            accessibilityState={{ checked: isVoiceEnabled }}
            accessible
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
  locationDotWrapper: {
    position: 'absolute',
    bottom: '35%',
    left: '45%',
  },
  mapPlaceholder: { fontSize: 20, fontWeight: '700', color: COLORS.textMuted },
  mapSubtext: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
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
    minHeight: 56,
  },
  bannerText: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  bannerLandmark: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 12,
    borderRadius: 3,
  },
  progressFill: {
    height: 6,
    backgroundColor: COLORS.success,
    borderRadius: 3,
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
    width: 52,
    height: 52,
    borderRadius: 26,
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
    minHeight: 52,
    justifyContent: 'center',
  },
  nextButtonText: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
});
