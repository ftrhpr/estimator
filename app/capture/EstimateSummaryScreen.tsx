import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Linking,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import {
    ActivityIndicator,
    Appbar,
    Button,
    Card,
    Chip,
    Divider,
    IconButton,
    List,
    Modal,
    Portal,
    Text,
    TextInput,
} from 'react-native-paper';

import { BORDER_RADIUS, COLORS, SPACING, TYPOGRAPHY } from '../../src/config/constants';
import { createInspection, getAllInspections } from '../../src/services/firebase';
import { formatCurrencyGEL } from '../../src/utils/helpers';

const { width } = Dimensions.get('window');

interface EstimateItem {
  id: string;
  serviceName: string;
  serviceNameKa?: string;
  price: number;
  count?: number;
  photoAngle?: string;
  photoUri?: string;
}

interface CustomerInfo {
  name?: string;
  phone: string;
  isRepeat: boolean;
}

export default function EstimateSummaryScreen() {
  const params = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  
  const [estimateItems, setEstimateItems] = useState<EstimateItem[]>([]);
  const [photosData, setPhotosData] = useState<any[]>([]);
  const [partsData, setPartsData] = useState<any[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    phone: '',
    isRepeat: false,
  });
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [carModel, setCarModel] = useState('');
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [jobStarted, setJobStarted] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [invoiceSaved, setInvoiceSaved] = useState(false);
  
  const cameraRef = useRef<CameraView>(null);

  // Initialize estimate data from params
  React.useEffect(() => {
    const setMockEstimateData = () => {
      const mockItems: EstimateItem[] = [
        {
          id: '1',
          serviceName: 'Painting',
          price: 250,
          photoAngle: 'Side',
          photoUri: 'https://via.placeholder.com/100x80/E2E8F0/475569?text=Side',
        },
        {
          id: '2',
          serviceName: 'Dent Repair',
          price: 120,
          photoAngle: 'Damage Close-up',
          photoUri: 'https://via.placeholder.com/100x80/E2E8F0/475569?text=Damage',
        },
        {
          id: '3',
          serviceName: 'Polishing',
          price: 80,
          photoAngle: 'Front',
          photoUri: 'https://via.placeholder.com/100x80/E2E8F0/475569?text=Front',
        },
      ];
      setEstimateItems(mockItems);
      console.log('Using mock estimate data:', mockItems);
    };

    if (params.estimateData) {
      try {
        const data = JSON.parse(params.estimateData as string);
        console.log('Parsed estimateData from params:', data);
        const items = data.items || [];
        console.log('Items loaded:', items);
        setEstimateItems(items);
        setPhotosData(data.photos || []);
        setPartsData(data.parts || []);
      } catch (error) {
        console.error('Error parsing estimate data:', error);
        // Mock data for demo
        setMockEstimateData();
      }
    } else {
      console.log('No estimateData in params, using mock data');
      setMockEstimateData();
    }
  }, [params.estimateData]);

  const getTotalPrice = () => {
    return estimateItems.reduce((total, item) => total + item.price, 0);
  };

  const searchCustomerByPhone = async (phone: string) => {
    try {
      setSearchingCustomer(true);
      const cleanPhone = phone.replace(/\s/g, '');
      const inspections = await getAllInspections();
      
      // Find the most recent inspection for this phone number
      const customerInspections = inspections.filter(
        (inv: any) => inv.customerPhone && inv.customerPhone.replace(/\s/g, '') === cleanPhone
      );
      
      if (customerInspections.length > 0) {
        // Sort by date to get most recent
        const sortedInspections = customerInspections.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        const recentCustomer = sortedInspections[0];
        setCustomerName(recentCustomer.customerName || '');
        setCarModel(recentCustomer.carModel || '');
        
        // Show a notification that customer was found
        Alert.alert(
          'Customer Found',
          `Welcome back ${recentCustomer.customerName || 'Customer'}!\nVehicle: ${recentCustomer.carModel || 'Not specified'}`,
          [{ text: 'OK' }]
        );
        
        return true;
      }
      
      // New customer
      setCustomerName('');
      setCarModel('');
      return false;
    } catch (error) {
      console.error('Error searching customer:', error);
      return false;
    } finally {
      setSearchingCustomer(false);
    }
  };

  // Search customer when phone number is entered
  React.useEffect(() => {
    const georgianPhoneRegex = /^(\+995|995)?[0-9]{9}$/;
    const cleanPhone = phoneNumber.replace(/\s/g, '');
    
    if (cleanPhone.length >= 9 && georgianPhoneRegex.test(cleanPhone)) {
      const timeoutId = setTimeout(() => {
        searchCustomerByPhone(cleanPhone);
      }, 500); // Debounce 500ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [phoneNumber]);

  const handlePhoneSubmit = () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Phone Required', 'Please enter customer phone number');
      return;
    }

    // Validate Georgian phone number format
    const georgianPhoneRegex = /^(\+995|995)?[0-9]{9}$/;
    if (!georgianPhoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      Alert.alert('Invalid Phone', 'Please enter a valid Georgian phone number');
      return;
    }

    setCustomerInfo({
      name: customerName.trim() || undefined,
      phone: phoneNumber,
      isRepeat: false,
    });
    setShowCustomerModal(false);
  };

  const handleQRScan = async () => {
    if (!permission?.granted) {
      await requestPermission();
    }
    setShowQRScanner(true);
  };

  const handleQRCodeScanned = ({ data }: { data: string }) => {
    setShowQRScanner(false);
    
    try {
      // Parse customer QR data (would be JSON with customer info)
      const customerData = JSON.parse(data);
      setCustomerInfo({
        name: customerData.name,
        phone: customerData.phone,
        isRepeat: true,
      });
      setPhoneNumber(customerData.phone);
    } catch (error) {
      // Fallback: treat as phone number
      setPhoneNumber(data);
      setCustomerInfo({
        phone: data,
        isRepeat: true,
      });
    }
  };

  const generateAndSendPDF = async () => {
    if (!customerInfo.phone) {
      setShowCustomerModal(true);
      return;
    }

    try {
      setIsGeneratingPDF(true);
      
      // Simulate PDF generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const totalPrice = getTotalPrice();
      const itemCount = estimateItems.length;
      
      // Create WhatsApp message
      const message = `🚗 Auto Body Estimate\n\n` +
        `📋 Services: ${itemCount} items\n` +
        `💰 Total: ${formatCurrencyGEL(totalPrice)}\n\n` +
        `Services:\n` +
        estimateItems.map(item => `• ${item.serviceName} - ${formatCurrencyGEL(item.price)}`).join('\n') +
        `\n\n📄 Detailed PDF with photos attached.\n\n` +
        `Thank you for choosing our auto body services! 🔧`;

      // Format phone number for WhatsApp
      const cleanPhone = customerInfo.phone.replace(/\D/g, '');
      const whatsappPhone = cleanPhone.startsWith('995') ? cleanPhone : `995${cleanPhone}`;
      
      const whatsappUrl = `whatsapp://send?phone=${whatsappPhone}&text=${encodeURIComponent(message)}`;
      
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert('WhatsApp Not Available', 'Please install WhatsApp to send estimates');
      }
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate estimate. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const saveInvoice = async () => {
    if (!customerInfo.phone) {
      Alert.alert(
        'Customer Info Required',
        'Please add customer phone number before saving',
        [{ text: 'Add Customer', onPress: () => setShowCustomerModal(true) }]
      );
      return;
    }

    try {
      setIsSaving(true);
      // Prepare combined services array - including both manual services and tagged works
      // Include both English (serviceName) and Georgian (serviceNameKa) names
      const allServices = [...estimateItems.map(item => ({
        serviceName: item.serviceName,
        serviceNameKa: item.serviceNameKa || '',
        description: item.serviceName,
        hours: 1,
        hourly_rate: item.price,
        price: item.price,
        billable: true,
        notes: item.photoAngle ? `Tagged on photo: ${item.photoAngle}` : '',
      }))];
      
      console.log('EstimateItems for services:', estimateItems);
      console.log('AllServices before tagged works:', allServices);
      if (partsData && partsData.length > 0) {
        partsData.forEach((part: any) => {
          if (part.damages && part.damages.length > 0) {
            part.damages.forEach((damage: any) => {
              if (damage.services && damage.services.length > 0) {
                damage.services.forEach((service: any) => {
                  const existingService = allServices.find(s => s.description === service.name);
                  if (existingService) {
                    existingService.hourly_rate += service.price;
                  } else {
                    allServices.push({
                      description: service.name,
                      hours: 1,
                      hourly_rate: service.price,
                      billable: true,
                      notes: `Tagged damage on photo #${damage.photoIndex + 1}`,
                    });
                  }
                });
              }
            });
          }
        });
      }

      // Log the final services array
      console.log('Final services array being sent:', allServices);

      // Prepare invoice data
      const invoiceData = {
        customerName: customerInfo.name || customerName || 'N/A',
        customerPhone: customerInfo.phone,
        carModel: carModel || 'Unknown',
        totalPrice: getTotalPrice(),
        services: allServices,
        photos: photosData,
        parts: partsData,
        status: 'Pending',
        isRepeatCustomer: customerInfo.isRepeat,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      console.log('Complete invoice data being saved:', invoiceData);

      // Save to Firestore (using createInspection from firebase service)
      const docId = await createInspection(invoiceData);

      setInvoiceSaved(true);
      Alert.alert(
        'Invoice Saved!',
        `Invoice #${docId.slice(0, 8).toUpperCase()} has been saved successfully.`,
        [
          { text: 'View Cases', onPress: () => router.push('/(tabs)/cases') },
          { text: 'OK' }
        ]
      );
    } catch (error: any) {
      console.error('Error saving invoice:', error);
      const errorMessage = error?.message || 'Unknown error';
      Alert.alert(
        'Save Failed',
        `Failed to save invoice: ${errorMessage}\n\nPlease check:\n• Firebase is configured (.env file)\n• Internet connection\n• Firestore permissions`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartJob = () => {
    if (!customerInfo.phone) {
      Alert.alert(
        'Customer Info Required',
        'Please add customer phone number before starting the job',
        [{ text: 'Add Customer', onPress: () => setShowCustomerModal(true) }]
      );
      return;
    }

    Alert.alert(
      'Start Job',
      `Start work on ${estimateItems.length} services for ${formatCurrencyGEL(getTotalPrice())}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Start Work', 
          onPress: () => {
            setJobStarted(true);
            // Navigate to job management or back to dashboard
            setTimeout(() => {
              Alert.alert(
                'Job Started!',
                'Work has been marked as started. Track progress in the Cases tab.',
                [{ text: 'OK', onPress: () => router.push('/(tabs)/cases') }]
              );
            }, 1000);
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content 
          title="Estimate Summary"
          titleStyle={styles.headerTitle}
        />
        <Appbar.Action 
          icon="share-variant" 
          onPress={generateAndSendPDF}
          disabled={isGeneratingPDF}
        />
        <Appbar.Action 
          icon="api" 
          onPress={() => router.push('/admin/cpanel-test')}
          title="cPanel Test"
        />
      </Appbar.Header>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Total Summary Card */}
        <Card style={styles.totalCard}>
          <Card.Content>
            <View style={styles.totalHeader}>
              <Text style={styles.totalLabel}>Total Estimate</Text>
              <Text style={styles.totalPrice}>{formatCurrencyGEL(getTotalPrice())}</Text>
            </View>
            <Text style={styles.totalSubtext}>
              {estimateItems.length} service{estimateItems.length !== 1 ? 's' : ''} • Ready for customer approval
            </Text>
          </Card.Content>
        </Card>

        {/* Customer Info */}
        <Card style={styles.customerCard}>
          <Card.Content>
            <View style={styles.customerHeader}>
              <Text style={styles.sectionTitle}>Customer</Text>
              <IconButton
                icon="qrcode-scan"
                onPress={handleQRScan}
                size={20}
              />
            </View>

            {customerInfo.phone ? (
              <View style={styles.customerInfo}>
                {customerInfo.isRepeat && (
                  <Chip
                    icon="account-check"
                    mode="flat"
                    style={styles.repeatCustomerChip}
                    textStyle={styles.repeatCustomerText}
                  >
                    Repeat Customer
                  </Chip>
                )}
                <View style={styles.customerDetails}>
                  {customerInfo.name && (
                    <Text style={styles.customerName}>{customerInfo.name}</Text>
                  )}
                  <Text style={styles.customerPhone}>{customerInfo.phone}</Text>
                </View>
                <IconButton
                  icon="pencil"
                  onPress={() => setShowCustomerModal(true)}
                  size={18}
                />
              </View>
            ) : (
              <Button
                mode="outlined"
                onPress={() => setShowCustomerModal(true)}
                icon="account-plus"
                style={styles.addCustomerButton}
              >
                What is your number?
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Services Breakdown */}
        <Card style={styles.servicesCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Services Breakdown</Text>
            
            {estimateItems.map((item, index) => (
              <View key={item.id}>
                <List.Item
                  title={item.serviceName}
                  description={item.count && item.count > 1 ? `Quantity: ${item.count}` : 'Single service'}
                  right={() => (
                    <Text style={styles.itemPrice}>{formatCurrencyGEL(item.price)}</Text>
                  )}
                  left={() => (
                    <View style={styles.serviceIconContainer}>
                      <MaterialCommunityIcons 
                        name="wrench" 
                        size={24} 
                        color={COLORS.primary}
                      />
                      {item.count && item.count > 1 && (
                        <Chip 
                          mode="flat" 
                          style={styles.countBadge}
                          textStyle={styles.countBadgeText}
                        >
                          ×{item.count}
                        </Chip>
                      )}
                    </View>
                  )}
                  titleStyle={styles.serviceTitle}
                  descriptionStyle={styles.serviceDescription}
                />
                {index < estimateItems.length - 1 && <Divider />}
              </View>
            ))}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Button
          mode="contained"
          onPress={saveInvoice}
          loading={isSaving}
          disabled={isSaving || invoiceSaved}
          icon={invoiceSaved ? "check-circle" : "content-save"}
          style={[styles.actionButton, invoiceSaved ? styles.completedButton : styles.saveInvoiceButton]}
        >
          {isSaving ? 'Saving...' : invoiceSaved ? 'Invoice Saved!' : 'Save Invoice'}
        </Button>

        <Button
          mode="contained"
          onPress={generateAndSendPDF}
          loading={isGeneratingPDF}
          disabled={isGeneratingPDF}
          icon="whatsapp"
          style={[styles.actionButton, styles.whatsappButton]}
          labelStyle={styles.whatsappButtonText}
        >
          {isGeneratingPDF ? 'Generating PDF...' : 'Send via WhatsApp'}
        </Button>

        <Button
          mode="contained"
          onPress={handleStartJob}
          disabled={!customerInfo.phone || jobStarted}
          icon={jobStarted ? "check-circle" : "play-circle"}
          style={[styles.actionButton, jobStarted ? styles.completedButton : styles.startButton]}
        >
          {jobStarted ? 'Job Started!' : 'Start Job'}
        </Button>
      </View>

      {/* Customer Input Modal */}
      <Portal>
        <Modal
          visible={showCustomerModal}
          onDismiss={() => setShowCustomerModal(false)}
          contentContainerStyle={styles.customerModal}
        >
          <Text style={styles.modalTitle}>Customer Information</Text>
          <Text style={styles.modalSubtitle}>Enter customer details</Text>

          <TextInput
            label="Phone Number *"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            placeholder="+995 XXX XXX XXX"
            style={styles.phoneInput}
            autoFocus
            left={<TextInput.Icon icon="phone" />}
            right={searchingCustomer ? <ActivityIndicator size="small" /> : undefined}
          />

          <TextInput
            label="Customer Name"
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="John Doe"
            style={styles.phoneInput}
            left={<TextInput.Icon icon="account" />}
          />

          <TextInput
            label="Vehicle Model"
            value={carModel}
            onChangeText={setCarModel}
            placeholder="Toyota Camry 2020"
            style={styles.phoneInput}
            left={<TextInput.Icon icon="car" />}
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={handleQRScan}
              icon="qrcode-scan"
              style={styles.qrButton}
            >
              Scan QR
            </Button>
            <Button
              mode="contained"
              onPress={handlePhoneSubmit}
              style={styles.submitButton}
              disabled={!phoneNumber.trim()}
            >
              Save Customer
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* QR Scanner Modal */}
      <Portal>
        <Modal
          visible={showQRScanner}
          onDismiss={() => setShowQRScanner(false)}
          contentContainerStyle={styles.scannerModal}
        >
          <View style={styles.scannerHeader}>
            <Text style={styles.modalTitle}>Scan Customer QR</Text>
            <IconButton
              icon="close"
              onPress={() => setShowQRScanner(false)}
            />
          </View>
          
          {permission?.granted ? (
            <View style={styles.cameraContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                onBarcodeScanned={handleQRCodeScanned}
              >
                <View style={styles.scannerOverlay}>
                  <View style={styles.scannerFrame} />
                  <Text style={styles.scannerText}>
                    Position customer's QR code in the frame
                  </Text>
                </View>
              </CameraView>
            </View>
          ) : (
            <View style={styles.permissionContainer}>
              <MaterialCommunityIcons 
                name="camera-off" 
                size={48} 
                color={COLORS.text.tertiary} 
              />
              <Text style={styles.permissionText}>Camera access needed for QR scanning</Text>
              <Button mode="contained" onPress={requestPermission}>
                Grant Permission
              </Button>
            </View>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    elevation: 2,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  totalCard: {
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    elevation: 3,
    backgroundColor: COLORS.primary,
  },
  totalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: COLORS.text.onPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  totalPrice: {
    color: COLORS.text.onPrimary,
    fontSize: 32,
    fontWeight: 'bold',
  },
  totalSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: SPACING.xs,
  },
  customerCard: {
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    elevation: 2,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  repeatCustomerChip: {
    backgroundColor: COLORS.success,
  },
  repeatCustomerText: {
    color: COLORS.text.onPrimary,
    fontSize: 12,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
  customerPhone: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  addCustomerButton: {
    borderColor: COLORS.primary,
  },
  servicesCard: {
    borderRadius: BORDER_RADIUS.lg,
    elevation: 2,
    marginBottom: SPACING.xl,
  },
  servicePhoto: {
    width: 50,
    height: 40,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surfaceVariant,
  },
  serviceIconContainer: {
    width: 50,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.sm,
    position: 'relative',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: COLORS.primary,
    height: 18,
    minWidth: 18,
  },
  countBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    color: COLORS.text.onPrimary,
    fontWeight: 'bold',
  },
  serviceTitle: {
    fontWeight: '500',
  },
  serviceDescription: {
    color: COLORS.text.secondary,
    fontSize: 12,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    alignSelf: 'center',
  },
  actionButtons: {
    padding: SPACING.lg,
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  actionButton: {
    paddingVertical: SPACING.xs,
  },
  saveInvoiceButton: {
    backgroundColor: COLORS.primary,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  whatsappButtonText: {
    color: COLORS.text.onPrimary,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: COLORS.secondary,
  },
  completedButton: {
    backgroundColor: COLORS.success,
  },
  customerModal: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  phoneInput: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  qrButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
  scannerModal: {
    backgroundColor: COLORS.surface,
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    height: 400,
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scannerFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.md,
  },
  scannerText: {
    color: COLORS.text.onPrimary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  permissionText: {
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginVertical: SPACING.lg,
  },
});