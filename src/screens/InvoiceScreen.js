import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import {
    ActivityIndicator,
    Button,
    Card,
    Chip,
    Divider,
    Modal,
    Portal,
    Text,
    TextInput,
} from 'react-native-paper';
import { saveInspectionWithImages } from '../services/firebase';

export default function InvoiceScreen({ route, navigation }) {
  const { 
    photos = [], 
    photoData = [],
    damageData = [], 
    totalPrice = 0 
  } = route.params || {};
  
  const [customerName, setCustomerName] = useState('');
  const [carModel, setCarModel] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Group damage data by car part
  const groupByCarPart = () => {
    const grouped = {};
    
    damageData.forEach(damage => {
      if (!grouped[damage.part]) {
        grouped[damage.part] = [];
      }
      grouped[damage.part].push(damage);
    });
    
    return grouped;
  };

  // Calculate total for a specific car part and sum duplicate services
  const getPartTotal = (damages) => {
    let total = 0;
    damages.forEach(damage => {
      damage.services.forEach(service => {
        total += service.price;
      });
    });
    return total;
  };

  // Group services by name and sum their prices
  const groupServicesByName = (damages) => {
    const serviceMap = {};
    
    damages.forEach(damage => {
      damage.services.forEach(service => {
        const key = service.nameEn; // Use English name as key for grouping
        if (!serviceMap[key]) {
          serviceMap[key] = {
            name: service.name,
            nameEn: service.nameEn,
            totalPrice: 0,
            count: 0,
          };
        }
        serviceMap[key].totalPrice += service.price;
        serviceMap[key].count += 1;
      });
    });
    
    return Object.values(serviceMap);
  };

  // Format currency in GEL
  const formatGEL = (amount) => {
    return `₾${parseFloat(amount).toFixed(2)}`;
  };

  // Format date
  const formatDate = () => {
    const date = new Date();
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Generate HTML for PDF
  const generatePDFHTML = () => {
    const groupedData = groupByCarPart();
    const date = formatDate();
    
    // Generate car parts sections
    let partsHTML = '';
    Object.keys(groupedData).forEach((part, partIndex) => {
      const damages = groupedData[part];
      const partTotal = getPartTotal(damages);
      
      partsHTML += `
        <div class="part-section">
          <div class="part-header">
            <div class="part-title">
              <span class="part-number">${partIndex + 1}.</span>
              <h3>${part}</h3>
            </div>
            <div class="part-total">${formatGEL(partTotal)}</div>
          </div>
          
          <table class="services-table">
            <thead>
              <tr>
                <th>Service (Georgian)</th>
                <th>Service (English)</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Price</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      // Group and sum services
      const groupedServices = groupServicesByName(damages);
      groupedServices.forEach((service) => {
        partsHTML += `
          <tr>
            <td><strong>${service.name}</strong></td>
            <td>${service.nameEn}</td>
            <td class="text-right">${service.count}x</td>
            <td class="text-right">${formatGEL(service.totalPrice)}</td>
          </tr>
        `;
      });
      
      partsHTML += `
            </tbody>
          </table>
        </div>
      `;
    });

    // Generate photos section
    let photosHTML = '';
    if (photos.length > 0) {
      photosHTML = `
        <div class="photos-section">
          <h2>Photos</h2>
          <div class="photos-grid">
      `;
      
      photos.forEach((photo, index) => {
        const label = photoData[index]?.label || `Photo ${index + 1}`;
        photosHTML += `
          <div class="photo-item">
            <img src="${photo}" alt="${label}" />
            <p class="photo-label">${label}</p>
          </div>
        `;
      });
      
      photosHTML += `
          </div>
        </div>
      `;
    }

    // Complete HTML
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Auto Service Invoice</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 40px;
            background: #fff;
          }
          
          .invoice-header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 3px solid #2563EB;
          }
          
          .company-name {
            font-size: 36px;
            font-weight: bold;
            color: #2563EB;
            margin-bottom: 10px;
          }
          
          .invoice-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            padding: 20px;
            background: #f9fafb;
            border-radius: 8px;
          }
          
          .info-block {
            flex: 1;
          }
          
          .info-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
          }
          
          .info-value {
            font-size: 16px;
            font-weight: 600;
            color: #111827;
          }
          
          .part-section {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          
          .part-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #2563EB;
            color: white;
            padding: 12px 20px;
            border-radius: 8px 8px 0 0;
          }
          
          .part-title {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .part-number {
            font-size: 20px;
            font-weight: bold;
          }
          
          .part-title h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
          }
          
          .part-total {
            font-size: 20px;
            font-weight: bold;
          }
          
          .services-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          .services-table thead {
            background: #f3f4f6;
          }
          
          .services-table th {
            padding: 12px 15px;
            text-align: left;
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .services-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .services-table tbody tr:last-child td {
            border-bottom: none;
          }
          
          .services-table tbody tr:hover {
            background: #f9fafb;
          }
          
          .pin-badge {
            display: inline-block;
            width: 28px;
            height: 28px;
            line-height: 28px;
            text-align: center;
            background: #ef4444;
            color: white;
            border-radius: 50%;
            font-weight: bold;
            font-size: 14px;
          }
          
          .text-right {
            text-align: right;
          }
          
          .total-section {
            margin-top: 40px;
            padding: 20px;
            background: #f0f9ff;
            border: 2px solid #2563EB;
            border-radius: 8px;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 15px 0;
            font-size: 24px;
            font-weight: bold;
            color: #2563EB;
          }
          
          .photos-section {
            margin-top: 50px;
            page-break-before: always;
          }
          
          .photos-section h2 {
            font-size: 24px;
            color: #111827;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
          }
          
          .photos-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
          
          .photo-item {
            text-align: center;
            page-break-inside: avoid;
          }
          
          .photo-item img {
            width: 100%;
            height: 300px;
            object-fit: contain;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            background: #f9fafb;
          }
          
          .photo-label {
            margin-top: 10px;
            font-size: 14px;
            font-weight: 600;
            color: #6b7280;
          }
          
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="invoice-header">
          <div class="company-name">My Auto Service</div>
          <div style="font-size: 18px; color: #6b7280; margin-top: 5px;">
            Auto Body Repair & Damage Assessment
          </div>
        </div>
        
        <!-- Invoice Info -->
        <div class="invoice-info">
          <div class="info-block">
            <div class="info-label">Date</div>
            <div class="info-value">${date}</div>
          </div>
          <div class="info-block">
            <div class="info-label">Customer</div>
            <div class="info-value">${customerName || 'N/A'}</div>
          </div>
          <div class="info-block">
            <div class="info-label">Car Model</div>
            <div class="info-value">${carModel || 'N/A'}</div>
          </div>
          <div class="info-block">
            <div class="info-label">Phone</div>
            <div class="info-value">${phoneNumber || 'N/A'}</div>
          </div>
        </div>
        
        <!-- Damage Assessment by Car Part -->
        ${partsHTML}
        
        <!-- Total -->
        <div class="total-section">
          <div class="total-row">
            <span>TOTAL ESTIMATE:</span>
            <span>${formatGEL(totalPrice)}</span>
          </div>
        </div>
        
        <!-- Photos -->
        ${photosHTML}
        
        <!-- Footer -->
        <div class="footer">
          <p>This is an estimated quote for auto body repair services.</p>
          <p>Final pricing may vary based on actual work performed.</p>
          <p style="margin-top: 10px; font-weight: 600;">Thank you for choosing My Auto Service!</p>
        </div>
      </body>
      </html>
    `;
  };

  const handleGeneratePDF = async () => {
    if (!customerName || !carModel) {
      Alert.alert('Missing Information', 'Please enter customer name and car model.');
      return;
    }

    setLoading(true);
    try {
      const html = generatePDFHTML();
      const { uri } = await Print.printToFileAsync({ html });
      
      Alert.alert(
        'PDF Generated',
        'Your invoice has been generated successfully!',
        [
          {
            text: 'Share',
            onPress: () => shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' })
          },
          { text: 'OK', style: 'default' }
        ]
      );
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!customerName || !carModel) {
      Alert.alert('Missing Information', 'Please enter customer name and car model.');
      return;
    }

    setLoading(true);
    try {
      const html = generatePDFHTML();
      await Print.printAsync({ html });
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Error', 'Failed to print. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!customerName || !carModel) {
      Alert.alert('Missing Information', 'Please enter customer name and car model.');
      return;
    }

    setLoading(true);
    try {
      const html = generatePDFHTML();
      const { uri } = await Print.printToFileAsync({ html });
      
      // Try to share via WhatsApp
      const whatsappURL = `whatsapp://send?text=${encodeURIComponent('Auto Service Invoice - ' + customerName)}`;
      const canOpen = await Linking.canOpenURL(whatsappURL);
      
      if (canOpen) {
        // First share the PDF, then open WhatsApp
        await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert(
          'WhatsApp Not Available',
          'WhatsApp is not installed. The PDF will be shared via other apps.',
          [
            {
              text: 'Share Anyway',
              onPress: () => shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' })
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      console.error('WhatsApp share error:', error);
      Alert.alert('Error', 'Failed to share via WhatsApp. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndClose = async () => {
    if (!customerName || !carModel || !phoneNumber) {
      Alert.alert(
        'Missing Information',
        'Please enter customer name, car model, and phone number to save.'
      );
      return;
    }

    Alert.alert(
      'Save Inspection',
      'This will upload all photos to cloud storage and save the inspection data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            setIsSaving(true);
            try {
              // Upload images and save to Firestore using Promise.all
              const inspectionId = await saveInspectionWithImages({
                photos,
                photoData,
                damageData,
                customerName,
                customerPhone: phoneNumber,
                carModel,
                totalPrice,
              });

              Alert.alert(
                'Success!',
                'Inspection saved successfully to cloud storage.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate back to home
                      navigation.navigate('Home');
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('Save error:', error);
              Alert.alert(
                'Error',
                'Failed to save inspection. Please check your internet connection and try again.\n\n' + error.message
              );
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  };

  const groupedData = groupByCarPart();
  const totalDamagePoints = damageData.length;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        
        {/* Header Section */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.headerContent}>
              <MaterialCommunityIcons name="file-document-edit" size={48} color="#2563EB" />
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Invoice Generator</Text>
                <Text style={styles.headerSubtitle}>
                  {totalDamagePoints} damage point{totalDamagePoints !== 1 ? 's' : ''} • {Object.keys(groupedData).length} part{Object.keys(groupedData).length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Customer Information */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Customer Information</Text>
            
            <TextInput
              label="Customer Name *"
              value={customerName}
              onChangeText={setCustomerName}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="account" />}
              placeholder="Enter customer name"
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
              label="Phone Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
              left={<TextInput.Icon icon="phone" />}
              placeholder="Enter phone number"
            />
          </Card.Content>
        </Card>

        {/* Summary by Car Part */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Damage Assessment Summary</Text>
            
            {Object.keys(groupedData).map((part, index) => {
              const damages = groupedData[part];
              const partTotal = getPartTotal(damages);
              const groupedServices = groupServicesByName(damages);
              
              return (
                <View key={part} style={styles.partSummary}>
                  <View style={styles.partHeader}>
                    <View style={styles.partInfo}>
                      <Text style={styles.partNumber}>{index + 1}.</Text>
                      <Text style={styles.partName}>{part}</Text>
                    </View>
                    <Chip 
                      mode="flat" 
                      style={styles.serviceCountChip}
                      textStyle={styles.serviceCountText}
                    >
                      {groupedServices.length} service{groupedServices.length !== 1 ? 's' : ''}
                    </Chip>
                  </View>
                  
                  {groupedServices.map((service, serviceIdx) => (
                    <View key={serviceIdx} style={styles.serviceRow}>
                      <View style={styles.serviceInfo}>
                        <Text style={styles.serviceNameGe}>{service.name}</Text>
                        {service.count > 1 && (
                          <Text style={styles.serviceCount}> × {service.count}</Text>
                        )}
                      </View>
                      <Text style={styles.servicePrice}>{formatGEL(service.totalPrice)}</Text>
                    </View>
                  ))}
                  
                  <Divider style={styles.partDivider} />
                  
                  <View style={styles.partTotal}>
                    <Text style={styles.partTotalLabel}>{part} Total:</Text>
                    <Text style={styles.partTotalValue}>{formatGEL(partTotal)}</Text>
                  </View>
                </View>
              );
            })}
          </Card.Content>
        </Card>

        {/* Total Section */}
        <Card style={styles.totalCard}>
          <Card.Content>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL ESTIMATE</Text>
              <Text style={styles.totalValue}>{formatGEL(totalPrice)}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Button
            mode="contained"
            onPress={handleSaveAndClose}
            disabled={loading || isSaving}
            loading={isSaving}
            style={[styles.actionButton, styles.saveButton]}
            buttonColor="#10b981"
            icon="cloud-upload"
          >
            {isSaving ? 'Saving to Cloud...' : 'Save & Close'}
          </Button>

          <Divider style={styles.actionDivider} />
          
          <Button
            mode="contained"
            onPress={handleGeneratePDF}
            disabled={loading || isSaving}
            loading={loading && !isSaving}
            style={styles.actionButton}
            buttonColor="#2563EB"
            icon="file-pdf-box"
          >
            Generate PDF
          </Button>
          
          <View style={styles.buttonRow}>
            <Button
              mode="outlined"
              onPress={handlePrint}
              disabled={loading || isSaving}
              style={[styles.actionButton, styles.halfButton]}
              icon="printer"
            >
              Print
            </Button>
            
            <Button
              mode="outlined"
              onPress={handleShareWhatsApp}
              disabled={loading || isSaving}
              style={[styles.actionButton, styles.halfButton]}
              buttonColor="#25D366"
              textColor="#25D366"
              icon="whatsapp"
            >
              WhatsApp
            </Button>
          </View>
        </View>

        {/* Photos Preview */}
        {photos.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Photos ({photos.length})</Text>
              <Text style={styles.photosHint}>
                Photos will be included at the bottom of the PDF invoice
              </Text>
              <View style={styles.photosPreview}>
                {photos.slice(0, 4).map((photo, index) => (
                  <View key={index} style={styles.photoThumb}>
                    <Image source={{ uri: photo }} style={styles.photoThumbImage} />
                    <Text style={styles.photoThumbLabel} numberOfLines={1}>
                      {photoData[index]?.label || `Photo ${index + 1}`}
                    </Text>
                  </View>
                ))}
                {photos.length > 4 && (
                  <View style={[styles.photoThumb, styles.photoThumbMore]}>
                    <Text style={styles.photoThumbMoreText}>+{photos.length - 4}</Text>
                    <Text style={styles.photoThumbLabel}>more</Text>
                  </View>
                )}
              </View>
            </Card.Content>
          </Card>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Loading Modal */}
      <Portal>
        <Modal visible={loading || isSaving} dismissable={false}>
          <View style={styles.loadingModal}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>
              {isSaving ? 'Uploading photos and saving...' : 'Generating invoice...'}
            </Text>
            {isSaving && (
              <Text style={styles.loadingSubtext}>
                This may take a moment depending on your internet speed
              </Text>
            )}
          </View>
        </Modal>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  
  // Header Card
  headerCard: {
    margin: 16,
    marginBottom: 12,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 16,
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  
  // Card
  card: {
    margin: 16,
    marginTop: 0,
    marginBottom: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  
  // Input
  input: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  
  // Part Summary
  partSummary: {
    marginBottom: 24,
  },
  partHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  partInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  partNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563EB',
    marginRight: 8,
  },
  partName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  serviceCountChip: {
    backgroundColor: '#eff6ff',
  },
  serviceCountText: {
    color: '#2563EB',
    fontSize: 12,
  },
  
  // Damage Item
  damageItem: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingVertical: 8,
  },
  pinBadgeSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pinBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  servicesColumn: {
    flex: 1,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceNameGe: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  serviceNameEn: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  serviceCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 2,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 12,
  },
  
  // Part Total
  partDivider: {
    marginVertical: 12,
  },
  partTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  partTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  partTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  
  // Total Card
  totalCard: {
    margin: 16,
    marginTop: 0,
    marginBottom: 12,
    backgroundColor: '#eff6ff',
    elevation: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  totalValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  
  // Actions
  actionsContainer: {
    paddingHorizontal: 16,
  },
  actionButton: {
    marginBottom: 12,
    paddingVertical: 6,
  },
  saveButton: {
    elevation: 4,
  },
  actionDivider: {
    marginVertical: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfButton: {
    flex: 1,
  },
  
  // Photos Preview
  photosHint: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  photosPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoThumb: {
    width: 80,
    alignItems: 'center',
  },
  photoThumbImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photoThumbLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  photoThumbMore: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    height: 80,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photoThumbMoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  
  // Loading Modal
  loadingModal: {
    backgroundColor: 'white',
    padding: 32,
    margin: 32,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
});
