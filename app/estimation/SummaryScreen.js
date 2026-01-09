import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Appbar,
  Text,
  Button,
  TextInput,
  Card,
  Divider,
  ActivityIndicator,
  Portal,
  Modal,
  List,
  Avatar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/config/firebaseConfig';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

// Georgian translations for service types
const SERVICE_TRANSLATIONS = {
  'painting': 'ღებვა',
  'dent_repair': 'ჩაღრმავების შეკეთება',
  'scratch_repair': 'ხაზების შეკეთება',
  'bumper_repair': 'ბამპერის შეკეთება',
  'panel_replacement': 'პანელის შეცვლა',
  'glass_repair': 'მინის შეკეთება',
  'other': 'სხვა'
};

export default function SummaryScreen() {
  const params = useLocalSearchParams();
  const [summaryData, setSummaryData] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [carModel, setCarModel] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);

  useEffect(() => {
    if (params.data) {
      try {
        const data = JSON.parse(params.data);
        setSummaryData(data);
      } catch (error) {
        console.error('Error parsing summary data:', error);
        Alert.alert('Error', 'Failed to load estimate data');
        router.back();
      }
    }
  }, [params.data]);

  // Calculate total price from all pins across all photos
  const calculateTotalPrice = () => {
    if (!summaryData || !summaryData.pins) return 0;
    
    let total = 0;
    Object.values(summaryData.pins).forEach(imagePins => {
      if (Array.isArray(imagePins)) {
        imagePins.forEach(pin => {
          total += parseFloat(pin.price || 0);
        });
      }
    });
    
    return total;
  };

  // Format currency in GEL
  const formatGEL = (amount) => {
    return `${parseFloat(amount).toLocaleString('en-US', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 
    })}₾`;
  };

  // Generate PDF Invoice
  const generatePDFInvoice = async () => {
    try {
      const totalPrice = calculateTotalPrice();
      const allPins = getAllPinsWithContext();
      const currentDate = new Date().toLocaleDateString('ka-GE');
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {
                    font-family: 'Arial', sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #2563EB;
                    padding-bottom: 20px;
                }
                .logo-placeholder {
                    width: 80px;
                    height: 80px;
                    background: #f0f0f0;
                    border: 2px dashed #ccc;
                    margin: 0 auto 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #666;
                    font-size: 12px;
                }
                .company-name {
                    font-size: 28px;
                    font-weight: bold;
                    color: #2563EB;
                    margin-bottom: 5px;
                }
                .subtitle {
                    color: #666;
                    font-size: 16px;
                }
                .invoice-details {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 30px;
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                }
                .customer-info, .invoice-info {
                    flex: 1;
                }
                .invoice-info {
                    text-align: right;
                }
                .info-label {
                    font-weight: bold;
                    color: #2563EB;
                    margin-bottom: 5px;
                }
                .info-value {
                    margin-bottom: 10px;
                    font-size: 16px;
                }
                .table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .table th {
                    background: #2563EB;
                    color: white;
                    padding: 15px;
                    text-align: left;
                    font-weight: bold;
                }
                .table td {
                    padding: 12px 15px;
                    border-bottom: 1px solid #eee;
                }
                .table tr:nth-child(even) {
                    background: #f8f9fa;
                }
                .table tr:hover {
                    background: #e3f2fd;
                }
                .price {
                    text-align: right;
                    font-weight: bold;
                    color: #10b981;
                }
                .total-section {
                    text-align: right;
                    margin-top: 30px;
                    padding: 20px;
                    background: #f0fdf4;
                    border-radius: 8px;
                    border-left: 4px solid #10b981;
                }
                .total-label {
                    font-size: 18px;
                    color: #666;
                    margin-bottom: 10px;
                }
                .total-amount {
                    font-size: 32px;
                    font-weight: bold;
                    color: #10b981;
                }
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    color: #666;
                    font-size: 14px;
                    border-top: 1px solid #eee;
                    padding-top: 20px;
                }
                .photo-indicator {
                    background: #e3f2fd;
                    color: #2563EB;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo-placeholder">
                    LOGO
                </div>
                <div class="company-name">My Auto Service</div>
                <div class="subtitle">Professional Auto Body Repair & Estimation</div>
            </div>
            
            <div class="invoice-details">
                <div class="customer-info">
                    <div class="info-label">Customer Details</div>
                    <div class="info-value"><strong>Name:</strong> ${customerName || 'N/A'}</div>
                    <div class="info-value"><strong>Car Model:</strong> ${carModel || 'N/A'}</div>
                    <div class="info-value"><strong>Phone:</strong> ${phoneNumber || 'N/A'}</div>
                </div>
                <div class="invoice-info">
                    <div class="info-label">Invoice Details</div>
                    <div class="info-value"><strong>Date:</strong> ${currentDate}</div>
                    <div class="info-value"><strong>Photos:</strong> ${summaryData?.images?.length || 0}</div>
                    <div class="info-value"><strong>Damage Points:</strong> ${allPins.length}</div>
                </div>
            </div>
            
            <table class="table">
                <thead>
                    <tr>
                        <th>Photo</th>
                        <th>Work Type (Georgian)</th>
                        <th>Work Type (English)</th>
                        <th>Price (GEL)</th>
                    </tr>
                </thead>
                <tbody>
                    ${allPins.map(pin => `
                        <tr>
                            <td><span class="photo-indicator">${pin.photoName}</span></td>
                            <td>${SERVICE_TRANSLATIONS[pin.service] || pin.service}</td>
                            <td>${pin.serviceLabel}</td>
                            <td class="price">${formatGEL(pin.price)}</td>
                        </tr>
                    `).join('')}
                    ${allPins.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #666; font-style: italic;">No damage points assessed</td></tr>' : ''}
                </tbody>
            </table>
            
            <div class="total-section">
                <div class="total-label">Total Amount</div>
                <div class="total-amount">${formatGEL(totalPrice)}</div>
            </div>
            
            <div class="footer">
                <p>This estimate is valid for 30 days from the date of issue.</p>
                <p>Generated by My Auto Service Estimation System</p>
            </div>
        </body>
        </html>
      `;
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });
      
      return uri;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  };

  // Get all pins with photo context
  const getAllPinsWithContext = () => {
    if (!summaryData || !summaryData.pins) return [];
    
    const pinsWithContext = [];
    
    Object.entries(summaryData.pins).forEach(([photoIndex, imagePins]) => {
      if (Array.isArray(imagePins)) {
        imagePins.forEach(pin => {
          pinsWithContext.push({
            ...pin,
            photoIndex: parseInt(photoIndex) + 1,
            photoName: `Photo ${parseInt(photoIndex) + 1}`
          });
        });
      }
    });
    
    return pinsWithContext;
  };

  // Validate form inputs
  const validateForm = () => {
    if (!customerName.trim()) {
      Alert.alert('Validation Error', 'Please enter customer name');
      return false;
    }
    
    if (!carModel.trim()) {
      Alert.alert('Validation Error', 'Please enter car model');
      return false;
    }
    
    if (!phoneNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter phone number');
      return false;
    }
    
    // Basic phone validation for Georgian numbers
    const phoneRegex = /^(\+995|995|0)?[1-9]\d{8}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      Alert.alert('Validation Error', 'Please enter a valid Georgian phone number');
      return false;
    }
    
    return true;
  };

  // Save estimate to Firebase Firestore
  const saveEstimate = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const totalPrice = calculateTotalPrice();
      const allPins = getAllPinsWithContext();
      
      const estimateData = {
        // Customer Information
        customerName: customerName.trim(),
        carModel: carModel.trim(),
        phoneNumber: phoneNumber.trim(),
        
        // Estimate Details
        totalPrice: totalPrice,
        totalPins: allPins.length,
        totalPhotos: summaryData?.images?.length || 0,
        
        // Photos and Pins
        images: summaryData?.images || [],
        pins: summaryData?.pins || {},
        pinsWithContext: allPins,
        
        // Metadata
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        
        // Additional fields
        currency: 'GEL',
        estimateNumber: `EST-${Date.now()}`,
      };
      
      const docRef = await addDoc(collection(db, 'estimates'), estimateData);
      console.log('Estimate saved with ID:', docRef.id);
      
      // Generate PDF Invoice
      try {
        const pdfUri = await generatePDFInvoice();
        
        // Share PDF
        await shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Invoice PDF',
          UTI: 'com.adobe.pdf'
        });
        
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        Alert.alert(
          'PDF Error',
          'Estimate saved successfully, but PDF generation failed. You can access the estimate from the history.',
          [{ text: 'OK' }]
        );
      }
      
      setSaveModalVisible(true);
      
    } catch (error) {
      console.error('Error saving estimate:', error);
      Alert.alert(
        'Save Error',
        'Failed to save estimate. Please check your internet connection and try again.',
        [
          { text: 'Retry', onPress: saveEstimate },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    setSaveModalVisible(false);
    // Navigate back to home or estimates list
    router.push('/(tabs)');
  };

  if (!summaryData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading estimate summary...</Text>
      </View>
    );
  }

  const totalPrice = calculateTotalPrice();
  const allPins = getAllPinsWithContext();

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Estimate Summary" />
      </Appbar.Header>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Total Price Card */}
        <Card style={styles.totalCard}>
          <Card.Content style={styles.totalContent}>
            <MaterialCommunityIcons name="calculator" size={32} color="#10b981" />
            <View style={styles.totalTextContainer}>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalAmount}>{formatGEL(totalPrice)}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Estimate Details */}
        <Card style={styles.detailsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Estimate Details</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Photos:</Text>
              <Text style={styles.summaryValue}>{summaryData.images?.length || 0}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Damage Points:</Text>
              <Text style={styles.summaryValue}>{allPins.length}</Text>
            </View>
            
            <Divider style={styles.divider} />
            
            {/* Pin Details List */}
            <Text style={styles.subsectionTitle}>Damage Assessment</Text>
            
            {allPins.length === 0 ? (
              <Text style={styles.noPinsText}>No damage points added</Text>
            ) : (
              allPins.map((pin, index) => (
                <View key={`${pin.photoIndex}-${pin.id}`} style={styles.pinItem}>
                  <Avatar.Icon 
                    size={32} 
                    icon={pin.icon} 
                    style={{ backgroundColor: pin.color }}
                  />
                  <View style={styles.pinDetails}>
                    <Text style={styles.pinText}>
                      {pin.photoName}: {pin.serviceLabel}
                    </Text>
                    <Text style={styles.pinPrice}>{formatGEL(pin.price)}</Text>
                  </View>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Customer Information Form */}
        <Card style={styles.customerCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            
            <TextInput
              label="Customer Name *"
              value={customerName}
              onChangeText={setCustomerName}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="account" />}
            />
            
            <TextInput
              label="Car Model *"
              value={carModel}
              onChangeText={setCarModel}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="car" />}
              placeholder="e.g., Toyota Camry 2020"
            />
            
            <TextInput
              label="Phone Number *"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
              left={<TextInput.Icon icon="phone" />}
              placeholder="+995 XXX XXX XXX"
            />
          </Card.Content>
        </Card>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <Button
          mode="contained"
          onPress={saveEstimate}
          disabled={loading || allPins.length === 0}
          loading={loading}
          style={styles.saveButton}
          buttonColor="#2563EB"
          icon="file-pdf-box"
        >
          {loading ? 'Generating PDF...' : 'Save & Generate PDF'}
        </Button>
      </View>

      {/* Success Modal */}
      <Portal>
        <Modal
          visible={saveModalVisible}
          onDismiss={handleFinish}
          contentContainerStyle={styles.successModal}
        >
          <MaterialCommunityIcons 
            name="check-circle" 
            size={64} 
            color="#10b981" 
            style={styles.successIcon}
          />
          <Text style={styles.successTitle}>Estimate Complete!</Text>
          <Text style={styles.successText}>
            Your estimate has been saved and PDF invoice has been generated for sharing.
          </Text>
          <Text style={styles.successDetails}>
            Total: {formatGEL(totalPrice)} • {allPins.length} damage points
          </Text>
          <Button
            mode="contained"
            onPress={handleFinish}
            style={styles.successButton}
            buttonColor="#10b981"
          >
            Continue
          </Button>
        </Modal>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2563EB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#374151',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  totalCard: {
    marginBottom: 16,
    elevation: 4,
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  totalContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10b981',
  },
  detailsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  divider: {
    marginVertical: 16,
  },
  noPinsText: {
    textAlign: 'center',
    color: '#6b7280',
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  pinItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pinDetails: {
    marginLeft: 12,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pinText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  pinPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  customerCard: {
    marginBottom: 16,
    elevation: 2,
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  bottomSpacing: {
    height: 100,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    elevation: 8,
  },
  saveButton: {
    paddingVertical: 8,
    borderRadius: 8,
  },
  successModal: {
    backgroundColor: 'white',
    margin: 32,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    elevation: 8,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  successDetails: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
    marginBottom: 24,
    textAlign: 'center',
  },
  successButton: {
    paddingHorizontal: 32,
    borderRadius: 8,
  },
});