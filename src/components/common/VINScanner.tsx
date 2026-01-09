import { Camera, CameraView } from 'expo-camera';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Card, IconButton, Text } from 'react-native-paper';
import { COLORS } from '../../config/constants';

interface VINScannerProps {
  onVINScanned: (vin: string) => void;
  onClose: () => void;
}

export const VINScanner: React.FC<VINScannerProps> = ({ onVINScanned, onClose }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    getCameraPermissions();
  }, []);

  const getCameraPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    
    // Basic VIN validation (17 characters, alphanumeric)
    const cleanVIN = data.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    if (cleanVIN.length === 17) {
      onVINScanned(cleanVIN);
      onClose();
    } else {
      Alert.alert(
        'Invalid VIN',
        'The scanned code does not appear to be a valid VIN. Please try again or enter manually.',
        [{ text: 'OK', onPress: () => setScanned(false) }]
      );
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Card style={styles.permissionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.permissionTitle}>
              Camera Permission Required
            </Text>
            <Text variant="bodyMedium" style={styles.permissionText}>
              This feature requires camera access to scan VIN barcodes. 
              Please enable camera permission in your device settings.
            </Text>
            <View style={styles.buttonContainer}>
              <Button mode="outlined" onPress={onClose} style={styles.button}>
                Cancel
              </Button>
              <Button mode="contained" onPress={getCameraPermissions} style={styles.button}>
                Request Permission
              </Button>
            </View>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.headerTitle}>
          Scan VIN Barcode
        </Text>
        <IconButton
          icon="close"
          onPress={onClose}
          iconColor="white"
          style={styles.closeButton}
        />
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'pdf417'],
          }}
        />
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.instructionText}>
            Position the VIN barcode within the frame
          </Text>
          
          {scanned && (
            <View style={styles.scannedContainer}>
              <Text style={styles.scannedText}>VIN Scanned!</Text>
              <Button
                mode="contained"
                onPress={() => setScanned(false)}
                style={styles.scanAgainButton}
              >
                Scan Again
              </Button>
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Point your camera at the VIN barcode typically found on the dashboard, door frame, or engine bay
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  headerTitle: {
    color: 'white',
    fontWeight: 'bold',
  },
  closeButton: {
    margin: 0,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  scanFrame: {
    width: 280,
    height: 80,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 8,
    backgroundColor: 'transparent',
    marginBottom: 32,
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scannedContainer: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  scannedText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  scanAgainButton: {
    backgroundColor: COLORS.primary,
  },
  footer: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 16,
  },
  footerText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionCard: {
    margin: 20,
  },
  permissionTitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: COLORS.text.primary,
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 24,
    color: COLORS.text.secondary,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  button: {
    flex: 1,
  },
});