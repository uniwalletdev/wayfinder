import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Camera, CameraView, BarcodeScanningResult } from 'expo-camera';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useNavigation } from '../hooks/useNavigation';
import { COLORS } from '../constants/colors';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'QRScanner'> };

export default function QRScannerScreen({ navigation }: Props) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const { scanQRCode } = useNavigation();

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    });
  }, []);

  const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);

    const location = await scanQRCode(data);
    if (location) {
      Alert.alert(
        'Location Found',
        `You are at: ${location.name}`,
        [{ text: 'Find My Destination', onPress: () => navigation.navigate('Home') }]
      );
    } else {
      Alert.alert('Not Recognised', 'This QR code is not a Wayfinder location.', [
        { text: 'Try Again', onPress: () => setScanned(false) },
      ]);
    }
  };

  if (hasPermission === null) {
    return <View style={styles.center}><Text>Requesting camera permission...</Text></View>;
  }

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Camera access is required to scan QR codes.</Text>
        <TouchableOpacity onPress={() => Camera.requestCameraPermissionsAsync()}>
          <Text style={styles.link}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.hint}>Point the camera at a Wayfinder QR code</Text>
        {scanned && (
          <TouchableOpacity style={styles.rescanButton} onPress={() => setScanned(false)}>
            <Text style={styles.rescanText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 16, color: COLORS.text, textAlign: 'center', marginBottom: 16 },
  link: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    marginBottom: 24,
  },
  hint: { color: '#fff', fontSize: 16, textAlign: 'center', paddingHorizontal: 32 },
  rescanButton: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  rescanText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
