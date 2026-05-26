import * as Speech from 'expo-speech';
import { CONFIG } from '../constants/config';

export async function speak(text: string): Promise<void> {
  const isSpeaking = await Speech.isSpeakingAsync();
  if (isSpeaking) {
    await Speech.stop();
  }
  Speech.speak(text, {
    rate: CONFIG.voiceRate,
    pitch: CONFIG.voicePitch,
    language: 'en-GB',
  });
}

export async function stopSpeaking(): Promise<void> {
  await Speech.stop();
}

export function buildInstruction(text: string, landmark?: string): string {
  if (landmark) {
    return `${text} at ${landmark}`;
  }
  return text;
}

export const ENCOURAGEMENT_PHRASES = [
  "You're doing great.",
  "Keep going, you're nearly there.",
  "Almost there!",
  "You're on the right track.",
];

export function getEncouragement(): string {
  return ENCOURAGEMENT_PHRASES[Math.floor(Math.random() * ENCOURAGEMENT_PHRASES.length)];
}
