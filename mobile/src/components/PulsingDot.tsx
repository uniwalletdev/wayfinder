import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

interface Props {
  size?: number;
  color?: string;
  accessible?: boolean;
  accessibilityLabel?: string;
}

export default function PulsingDot({
  size = 20,
  color = COLORS.primary,
  accessible = true,
  accessibilityLabel = 'Your current location',
}: Props) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = pulse(ring1, 0);
    const a2 = pulse(ring2, 700);
    a1.start();
    a2.start();

    return () => {
      a1.stop();
      a2.stop();
    };
  }, []);

  const ringStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
    transform: [
      {
        scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.5] }),
      },
    ],
  });

  return (
    <View
      style={[styles.wrapper, { width: size * 4, height: size * 4 }]}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      importantForAccessibility="yes"
    >
      <Animated.View style={ringStyle(ring1)} />
      <Animated.View style={ringStyle(ring2)} />
      {/* Solid centre dot */}
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
