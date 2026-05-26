import { useEffect, useRef } from 'react';
import { speak, stopSpeaking, buildInstruction, getEncouragement } from '../services/voice';
import { RouteInstruction } from '../types';

export function useVoiceGuidance(
  isEnabled: boolean,
  currentStep: number,
  instructions: RouteInstruction[]
) {
  const lastSpokenStep = useRef(-1);

  useEffect(() => {
    if (!isEnabled || currentStep === lastSpokenStep.current) return;
    if (currentStep >= instructions.length) return;

    const instruction = instructions[currentStep];
    const text = buildInstruction(instruction.text, instruction.landmark);

    const shouldEncourage = currentStep > 0 && currentStep % 3 === 0;
    const fullText = shouldEncourage
      ? `${getEncouragement()} ${text}`
      : text;

    speak(fullText);
    lastSpokenStep.current = currentStep;
  }, [isEnabled, currentStep, instructions]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);
}
