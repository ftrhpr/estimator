import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useNavigation } from 'expo-router';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  IconButton,
  Modal,
  Portal,
  Searchbar,
  Surface,
  Text,
} from 'react-native-paper';

import { BORDER_RADIUS, COLORS, SPACING, TYPOGRAPHY } from '../../src/config/constants';
import {
  getMatchedFieldsLabel,
  searchCases,
  SearchResult,
} from '../../src/services/caseSearchService';
import { formatCurrencyGEL } from '../../src/utils/helpers';

const { width, height } = Dimensions.get('window');

// QR Scanner overlay dimensions
const SCANNER_SIZE = width * 0.7;

export default function PlateScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedPlate, setScannedPlate] = useState<string | null>(null);
  const [manualPlate, setManualPlate] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(true);

  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '🔍 საქმეების ძიება',
      headerStyle: { backgroundColor: COLORS.surface },
      headerTintColor: COLORS.text.primary,
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const setupPermissions = async () => {
        if (!permission?.granted) {
          await requestPermission();
        }
      };
      setupPermissions();

      // Reset state and enable scanning when screen focuses
      setScanEnabled(true);
      return () => {
        setScannedPlate(null);
        setSearchResults([]);
        setShowResults(false);
      };
    }, [permission])
  );

  /**
   * Handle barcode/QR scan result
   */
  const handleBarcodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (!scanEnabled || isSearching) return;
    
    // Disable scanning temporarily to prevent multiple scans
    setScanEnabled(false);
    Vibration.vibrate(100);

    console.log('[CaseSearch] Scanned:', type, data);

    // Try to extract search term from scanned data
    let searchTerm = data.trim();

    // Check if it's JSON format (extract any relevant field)
    try {
      const jsonData = JSON.parse(data);
      // Priority: plate > phone > name > id
      searchTerm = jsonData.plate || jsonData.plateNumber || 
                   jsonData.phone || jsonData.customerPhone ||
                   jsonData.name || jsonData.customerName ||
                   jsonData.id || data;
    } catch {
      // Not JSON, use raw data as is
      // No need to restrict to plate format - search all fields
    }

    if (searchTerm && searchTerm.length >= 2) {
      setScannedPlate(searchTerm);
      await handleSearch(searchTerm);
    } else {
      Alert.alert(
        '❌ არასწორი QR კოდი',
        'QR კოდი არ შეიცავს საძიებო ინფორმაციას.',
        [
          { text: 'გაუქმება', onPress: () => setScanEnabled(true) },
          { text: 'ხელით შეყვანა', onPress: () => setShowManualInput(true) },
        ]
      );
    }
  };

  /**
   * Search for cases by any keyword
   */
  const handleSearch = async (query: string) => {
    if (!query || query.trim().length < 2) {
      Alert.alert('❌ შეცდომა', 'გთხოვთ შეიყვანოთ მინიმუმ 2 სიმბოლო');
      setScanEnabled(true);
      return;
    }

    try {
      setIsSearching(true);
      setShowResults(true);
      Keyboard.dismiss();

      console.log('[CaseSearch] Searching for:', query);
      const results = await searchCases(query, { limit: 20, minRelevance: 10 });

      setSearchResults(results);
      console.log('[CaseSearch] Found', results.length, 'results');

      if (results.length === 1) {
        // Single exact match - navigate directly
        Vibration.vibrate([0, 200]);
        const matchInfo = getMatchedFieldsLabel(results[0].matchedFields);
        Alert.alert(
          '✅ ნაპოვნია!',
          `${results[0].plate}\n${results[0].customerName}\n${results[0].carMake || ''} ${results[0].carModel || ''}\n\nშესაბამისობა: ${matchInfo}`,
          [
            { text: 'გაუქმება', style: 'cancel', onPress: () => setScanEnabled(true) },
            {
              text: 'გახსნა',
              onPress: () => navigateToCase(results[0]),
            },
          ]
        );
      } else if (results.length === 0) {
        Alert.alert(
          '❌ ვერ მოიძებნა', 
          `"${query}" საძიებო სიტყვით საქმე ვერ მოიძებნა.`,
          [{ text: 'OK', onPress: () => setScanEnabled(true) }]
        );
      }
    } catch (error) {
      console.error('[CaseSearch] Search error:', error);
      Alert.alert('❌ შეცდომა', 'ძიება ვერ მოხერხდა');
      setScanEnabled(true);
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Navigate to case detail screen
   */
  const navigateToCase = (result: SearchResult) => {
    setShowResults(false);
    router.push({
      pathname: '/cases/[id]',
      params: {
        id: result.id,
        source: result.source,
      },
    });
  };

  /**
   * Handle manual plate input submission
   */
  const handleManualSearch = () => {
    if (manualPlate.trim()) {
      setScannedPlate(manualPlate.trim().toUpperCase());
      handleSearch(manualPlate.trim());
      setShowManualInput(false);
    }
  };

  /**
   * Get status color
   */
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'დასრულებული':
        return '#10B981';
      case 'in service':
      case 'already in service':
      case 'სერვისშია':
        return '#EC4899';
      case 'processing':
      case 'მუშავდება':
        return '#8B5CF6';
      default:
        return '#3B82F6';
    }
  };

  /**
   * Format date
   */
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ka-GE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Permission handling
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialCommunityIcons name="camera-off" size={64} color={COLORS.text.tertiary} />
        <Text style={styles.permissionText}>კამერაზე წვდომა საჭიროა</Text>
        <Button mode="contained" onPress={requestPermission} style={{ marginTop: SPACING.md }}>
          ნებართვის მიცემა
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View with QR Scanner */}
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={flashEnabled}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8'],
        }}
        onBarcodeScanned={scanEnabled ? handleBarcodeScanned : undefined}
      >
        {/* Overlay with scanner frame */}
        <View style={styles.overlay}>
          {/* Top dark area */}
          <View style={styles.overlayTop}>
            <Text style={styles.titleText}>QR სკანერი</Text>
            <Text style={styles.subtitleText}>ნომერი | სახელი | ტელეფონი | მანქანა</Text>
          </View>

          {/* Middle row with scanner frame */}
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scannerFrame}>
              {/* Corner markers */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              
              {/* Scanning indicator */}
              {scanEnabled && !isSearching && (
                <View style={styles.scanLine} />
              )}
              
              {/* Loading indicator */}
              {isSearching && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>ძიება...</Text>
                </View>
              )}
            </View>
            <View style={styles.overlaySide} />
          </View>

          {/* Bottom dark area with controls */}
          <View style={styles.overlayBottom}>
            {/* Instructions */}
            <Text style={styles.instructionText}>
              {scanEnabled 
                ? 'დაასკანერეთ QR კოდი ან შეიყვანეთ ნომერი/სახელი/ტელეფონი' 
                : 'დაელოდეთ...'}
            </Text>

            {/* Scanned plate display */}
            {scannedPlate && (
              <Surface style={styles.scannedPlateCard}>
                <Text style={styles.scannedPlateLabel}>საძიებო სიტყვა:</Text>
                <Text style={styles.scannedPlateText}>{scannedPlate}</Text>
              </Surface>
            )}

            {/* Hint for QR format */}
            <View style={styles.hintContainer}>
              <MaterialCommunityIcons name="information-outline" size={16} color={COLORS.text.tertiary} />
              <Text style={styles.hintText}>
                ძიება შესაძლებელია: ნომრით, სახელით, ტელეფონით, მანქანის მოდელით
              </Text>
            </View>
          </View>
        </View>
      </CameraView>

      {/* Bottom Controls */}
      <View style={styles.controlsContainer}>
        {/* Flash toggle */}
        <IconButton
          icon={flashEnabled ? 'flash' : 'flash-off'}
          iconColor={flashEnabled ? COLORS.warning : COLORS.text.secondary}
          size={28}
          onPress={() => setFlashEnabled(!flashEnabled)}
          style={styles.sideButton}
        />

        {/* Re-scan button */}
        <IconButton
          icon="qrcode-scan"
          iconColor={scanEnabled ? COLORS.primary : COLORS.text.tertiary}
          size={48}
          onPress={() => {
            setScanEnabled(true);
            setScannedPlate(null);
          }}
          style={[styles.mainButton, !scanEnabled && styles.mainButtonDisabled]}
        />

        {/* Manual input toggle */}
        <IconButton
          icon="keyboard"
          iconColor={COLORS.text.secondary}
          size={28}
          onPress={() => {
            setScanEnabled(false);
            setShowManualInput(true);
          }}
          style={styles.sideButton}
        />
      </View>

      {/* Manual Input Modal */}
      <Portal>
        <Modal
          visible={showManualInput}
          onDismiss={() => {
            setShowManualInput(false);
            setScanEnabled(true);
          }}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>საქმის ძიება</Text>
          <Searchbar
            placeholder="ნომერი, სახელი, ტელეფონი, მანქანა..."
            value={manualPlate}
            onChangeText={setManualPlate}
            style={styles.searchInput}
            inputStyle={styles.searchInputText}
            autoFocus
            onSubmitEditing={handleManualSearch}
          />
          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowManualInput(false);
                setScanEnabled(true);
              }}
              style={styles.modalButton}
            >
              გაუქმება
            </Button>
            <Button
              mode="contained"
              onPress={handleManualSearch}
              style={styles.modalButton}
              disabled={!manualPlate.trim()}
            >
              ძიება
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Search Results Modal */}
      <Portal>
        <Modal
          visible={showResults}
          onDismiss={() => {
            setShowResults(false);
            setScanEnabled(true);
          }}
          contentContainerStyle={styles.resultsModalContainer}
        >
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>ძიების შედეგები</Text>
            {scannedPlate && (
              <Chip icon="magnify" style={styles.searchChip}>
                {scannedPlate}
              </Chip>
            )}
          </View>

          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.modalLoadingText}>მიმდინარეობს ძიება...</Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="car-off"
                size={64}
                color={COLORS.text.tertiary}
              />
              <Text style={styles.emptyText}>საქმეები ვერ მოიძებნა</Text>
            </View>
          ) : (
            <View style={styles.resultsList}>
              {searchResults.map((result) => (
                <Card
                  key={`${result.source}-${result.id}`}
                  style={styles.resultCard}
                  onPress={() => navigateToCase(result)}
                >
                  <Card.Content>
                    <View style={styles.resultHeader}>
                      <View style={styles.resultPlateContainer}>
                        <MaterialCommunityIcons
                          name="car-side"
                          size={20}
                          color={COLORS.primary}
                        />
                        <Text style={styles.resultPlate}>{result.plate}</Text>
                        <Chip
                          style={styles.relevanceChip}
                          textStyle={styles.relevanceChipText}
                          compact
                        >
                          {result.relevanceScore}%
                        </Chip>
                      </View>
                      <Chip
                        style={[
                          styles.statusChip,
                          { backgroundColor: getStatusColor(result.status) + '20' },
                        ]}
                        textStyle={{ color: getStatusColor(result.status), fontSize: 10 }}
                      >
                        {result.status}
                      </Chip>
                    </View>

                    <Text style={styles.resultCustomer}>{result.customerName}</Text>
                    
                    {/* Show matched fields */}
                    <View style={styles.matchedFieldsContainer}>
                      <MaterialCommunityIcons name="check-circle" size={12} color={COLORS.success} />
                      <Text style={styles.matchedFieldsText}>
                        {getMatchedFieldsLabel(result.matchedFields)}
                      </Text>
                    </View>

                    <View style={styles.resultDetails}>
                      <Text style={styles.resultCar}>
                        {result.carMake || ''} {result.carModel || ''}
                      </Text>
                      <Text style={styles.resultPrice}>
                        {formatCurrencyGEL(result.totalPrice)}
                      </Text>
                    </View>

                    <View style={styles.resultFooter}>
                      <Text style={styles.resultDate}>{formatDate(result.createdAt)}</Text>
                      <Chip
                        icon={result.source === 'firebase' ? 'firebase' : 'web'}
                        style={styles.sourceChip}
                        textStyle={styles.sourceChipText}
                      >
                        {result.source === 'firebase' ? 'Firebase' : 'CPanel'}
                      </Chip>
                    </View>
                  </Card.Content>
                </Card>
              ))}
            </View>
          )}

          <Button
            mode="outlined"
            onPress={() => {
              setShowResults(false);
              setScanEnabled(true);
            }}
            style={styles.closeButton}
          >
            დახურვა
          </Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  permissionText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: SPACING.lg,
  },
  titleText: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  subtitleText: {
    color: COLORS.text.tertiary,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: SCANNER_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  scannerFrame: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: COLORS.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: COLORS.primary,
    opacity: 0.8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  overlayBottom: {
    flex: 1.2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingTop: SPACING.lg,
    alignItems: 'center',
  },
  instructionText: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  scannedPlateCard: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  scannedPlateLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  scannedPlateText: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
    marginTop: SPACING.xs,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
  },
  hintText: {
    color: COLORS.text.tertiary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: '#000',
    gap: SPACING.xl,
  },
  sideButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  mainButton: {
    backgroundColor: COLORS.primary + '30',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  mainButtonDisabled: {
    opacity: 0.5,
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    margin: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  searchInput: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  searchInputText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  modalButton: {
    flex: 1,
  },
  resultsModalContainer: {
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    maxHeight: height * 0.8,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  resultsTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: 'bold',
    color: COLORS.text.primary,
  },
  searchChip: {
    backgroundColor: COLORS.primary + '20',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  modalLoadingText: {
    marginTop: SPACING.md,
    color: COLORS.text.secondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    marginTop: SPACING.md,
    color: COLORS.text.secondary,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  resultsList: {
    maxHeight: height * 0.5,
  },
  resultCard: {
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  resultPlateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  resultPlate: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    letterSpacing: 1,
  },
  relevanceChip: {
    height: 20,
    backgroundColor: COLORS.primary + '15',
    marginLeft: SPACING.xs,
  },
  relevanceChipText: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  statusChip: {
    height: 24,
  },
  resultCustomer: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  matchedFieldsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: 4,
  },
  matchedFieldsText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.success,
    fontStyle: 'italic',
  },
  resultDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  resultCar: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  resultPrice: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  resultFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultDate: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
  },
  sourceChip: {
    height: 22,
    backgroundColor: COLORS.outline + '40',
  },
  sourceChipText: {
    fontSize: 10,
  },
  closeButton: {
    marginTop: SPACING.md,
  },
});
