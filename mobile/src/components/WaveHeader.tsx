import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../constants/colors';

const { width } = Dimensions.get('window');

interface Props {
  title: string;
  subtitle?: string;
}

// Generates a sine wave SVG path that shifts horizontally as `offset` changes
function buildWavePath(offset: number): string {
  const h = 60;
  const amplitude = 12;
  const frequency = 0.012;
  let d = `M${-offset},${h}`;
  for (let x = -offset; x <= width + offset; x += 4) {
    const y = h - amplitude * Math.sin((x + offset) * frequency * Math.PI * 2);
    d += ` L${x},${y}`;
  }
  d += ` L${width + offset},0 L${-offset},0 Z`;
  return d;
}

export default function WaveHeader({ title, subtitle }: Props) {
  const waveAnim = useRef(new Animated.Value(0)).current;
  const pathRef = useRef('');

  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: width,
        duration: 3500,
        useNativeDriver: false,
      })
    ).start();
  }, []);

  // Derive the wave path from the animated value via a listener
  const [wavePath, setWavePath] = React.useState(() => buildWavePath(0));

  useEffect(() => {
    const id = waveAnim.addListener(({ value }) => {
      setWavePath(buildWavePath(value % width));
    });
    return () => waveAnim.removeListener(id);
  }, []);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="header"
    >
      {/* Solid blue fill */}
      <View style={styles.solidFill} />

      {/* Animated wave at the bottom edge */}
      <View style={styles.waveContainer} importantForAccessibility="no">
        <Svg width={width} height={60} style={StyleSheet.absoluteFill}>
          <Path d={wavePath} fill={COLORS.primary} />
        </Svg>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} accessibilityRole="text">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 60,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  solidFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.primary,
    bottom: 30,
  },
  waveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  textContainer: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
});
