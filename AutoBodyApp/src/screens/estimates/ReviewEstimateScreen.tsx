import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, FlatList } from 'react-native';
import { Appbar, Card, Text, Button, DataTable, Divider, FAB, ActivityIndicator } from 'react-native-paper';
import { EstimateReviewData, InvoiceLineItem, VisualEstimate, Service } from '../../types';
import { PDFService } from '../../services/pdfService';
import { ServiceService } from '../../services/serviceService';
import { GEORGIAN_LABELS } from '../../config/georgian';
import { COLORS, APP_CONFIG } from '../../config/constants';

interface ReviewEstimateScreenProps {
  estimateData: EstimateReviewData;
  onBack: () => void;
  onSave?: (data: EstimateReviewData) => void;
}

export const ReviewEstimateScreen: React.FC<ReviewEstimateScreenProps> = ({
  estimateData,
  onBack,
  onSave,
}) => {
  const [loading, setLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const serviceList = await ServiceService.getAllServices();
      setServices(serviceList);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const handleGeneratePDF = async () => {
    try {
      setPdfGenerating(true);
      
      const pdfUri = await PDFService.generateEstimatePDF(estimateData);
      
      Alert.alert(
        GEORGIAN_LABELS.pdfGeneratedSuccess,
        'გსურთ PDF-ის გაზიარება?',
        [
          { text: GEORGIAN_LABELS.cancel, style: 'cancel' },
          {
            text: GEORGIAN_LABELS.sharePDF,
            onPress: () => handleSharePDF(pdfUri),
          },
        ]
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert(GEORGIAN_LABELS.pdfGenerationError, error.message);
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleSharePDF = async (uri: string) => {
    try {
      const filename = `estimate_${estimateData.customer.lastName}_${new Date().toISOString().split('T')[0]}.pdf`;
      await PDFService.sharePDF(uri, filename);
    } catch (error) {
      console.error('Error sharing PDF:', error);
      Alert.alert(GEORGIAN_LABELS.sharingError, error.message);
    }
  };

  const handleSaveEstimate = () => {
    if (onSave) {
      onSave(estimateData);
      Alert.alert('შენახვა', 'შეფასება წარმატებით შეინახა!');
    }
  };

  const getServiceName = (serviceKey: string): { nameEn: string; nameKa: string } => {
    const service = services.find(s => s.key === serviceKey);
    return service ? { nameEn: service.nameEn, nameKa: service.nameKa } : { nameEn: serviceKey, nameKa: serviceKey };
  };

  const formatCurrencyGEL = (amount: number): string => {
    return `${amount.toFixed(2)} ${GEORGIAN_LABELS.currencySymbol}`;
  };

  const renderLineItem = (item: InvoiceLineItem, index: number) => (
    <DataTable.Row key={item.id}>
      <DataTable.Cell style={styles.itemCell}>
        <View>
          <Text variant="bodyMedium" style={styles.itemName}>
            {item.nameKa}
          </Text>
          <Text variant="bodySmall" style={styles.itemSubtext}>
            {item.nameEn}
          </Text>
          {item.damageZone && (
            <Text variant="bodySmall" style={styles.damageZone}>
              {item.damageZone}
            </Text>
          )}
        </View>
      </DataTable.Cell>
      <DataTable.Cell numeric style={styles.quantityCell}>
        <Text variant="bodyMedium">{item.quantity}</Text>
      </DataTable.Cell>
      <DataTable.Cell numeric style={styles.priceCell}>
        <Text variant="bodyMedium">{formatCurrencyGEL(item.unitPrice)}</Text>
      </DataTable.Cell>
      <DataTable.Cell numeric style={styles.totalCell}>
        <Text variant="bodyMedium" style={styles.totalAmount}>
          {formatCurrencyGEL(item.totalPrice)}
        </Text>
      </DataTable.Cell>
    </DataTable.Row>
  );

  const renderVisualEstimate = ({ item }: { item: VisualEstimate }) => (
    <Card style={styles.estimateCard}>
      <Card.Content>
        <View style={styles.estimateHeader}>
          <Text variant="titleSmall" style={styles.estimateTitle}>
            {item.damageZone}
          </Text>
          <Text variant="titleSmall" style={styles.estimateAmount}>
            {formatCurrencyGEL(item.cost)}
          </Text>
        </View>
        <Text variant="bodySmall" style={styles.repairTypes}>
          {GEORGIAN_LABELS.columnService}: {item.repairType.join(', ')}
        </Text>
        <Text variant="bodySmall" style={styles.photoAngle}>
          ფოტო: {item.photoAngle}
        </Text>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={onBack} />
        <Appbar.Content title="შეფასების მიმოხილვა" />
        {onSave && (
          <Appbar.Action icon="content-save" onPress={handleSaveEstimate} />
        )}
      </Appbar.Header>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Customer and Vehicle Info */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.sectionTitle}>
              {GEORGIAN_LABELS.customerInfo}
            </Text>
            
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.infoLabel}>
                {GEORGIAN_LABELS.customerName}:
              </Text>
              <Text variant="bodyMedium" style={styles.infoValue}>
                {estimateData.customer.firstName} {estimateData.customer.lastName}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.infoLabel}>
                {GEORGIAN_LABELS.customerPhone}:
              </Text>
              <Text variant="bodyMedium" style={styles.infoValue}>
                {estimateData.customer.phone}
              </Text>
            </View>

            {estimateData.customer.email && (
              <View style={styles.infoRow}>
                <Text variant="bodyMedium" style={styles.infoLabel}>
                  {GEORGIAN_LABELS.customerEmail}:
                </Text>
                <Text variant="bodyMedium" style={styles.infoValue}>
                  {estimateData.customer.email}
                </Text>
              </View>
            )}

            <Divider style={styles.divider} />

            <Text variant="titleMedium" style={styles.subsectionTitle}>
              {GEORGIAN_LABELS.vehicleInfo}
            </Text>
            
            <View style={styles.vehicleInfo}>
              <Text variant="bodyLarge" style={styles.vehicleModel}>
                {estimateData.vehicle.year} {estimateData.vehicle.make} {estimateData.vehicle.model}
              </Text>
              {estimateData.vehicle.vin && (
                <Text variant="bodySmall" style={styles.vin}>
                  {GEORGIAN_LABELS.vehicleVin}: {estimateData.vehicle.vin}
                </Text>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Visual Estimates */}
        {estimateData.visualEstimates.length > 0 && (
          <Card style={styles.visualEstimatesCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                ვიზუალური შეფასებები ({estimateData.visualEstimates.length})
              </Text>
              <FlatList
                data={estimateData.visualEstimates}
                renderItem={renderVisualEstimate}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.estimateSeparator} />}
              />
            </Card.Content>
          </Card>
        )}

        {/* Services and Parts Table */}
        <Card style={styles.servicesCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {GEORGIAN_LABELS.servicesTable}
            </Text>
            
            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={styles.itemHeader}>
                  {GEORGIAN_LABELS.columnItem}
                </DataTable.Title>
                <DataTable.Title numeric style={styles.quantityHeader}>
                  {GEORGIAN_LABELS.columnQuantity}
                </DataTable.Title>
                <DataTable.Title numeric style={styles.priceHeader}>
                  {GEORGIAN_LABELS.columnPrice}
                </DataTable.Title>
                <DataTable.Title numeric style={styles.totalHeader}>
                  {GEORGIAN_LABELS.columnTotal}
                </DataTable.Title>
              </DataTable.Header>

              {estimateData.lineItems.map((item, index) => 
                renderLineItem(item, index)
              )}
            </DataTable>
          </Card.Content>
        </Card>

        {/* Totals */}
        <Card style={styles.totalsCard}>
          <Card.Content>
            <View style={styles.totalRow}>
              <Text variant="bodyLarge" style={styles.totalLabel}>
                {GEORGIAN_LABELS.subtotal}:
              </Text>
              <Text variant="bodyLarge" style={styles.totalValue}>
                {formatCurrencyGEL(estimateData.subtotal)}
              </Text>
            </View>

            <View style={styles.totalRow}>
              <Text variant="bodyMedium" style={styles.totalLabel}>
                {GEORGIAN_LABELS.tax} ({(estimateData.taxRate * 100).toFixed(0)}%):
              </Text>
              <Text variant="bodyMedium" style={styles.totalValue}>
                {formatCurrencyGEL(estimateData.taxAmount)}
              </Text>
            </View>

            <Divider style={styles.totalDivider} />

            <View style={styles.totalRow}>
              <Text variant="headlineSmall" style={styles.finalTotalLabel}>
                {GEORGIAN_LABELS.totalAmount}:
              </Text>
              <Text variant="headlineSmall" style={styles.finalTotalValue}>
                {formatCurrencyGEL(estimateData.total)}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <View style={styles.actionButtons}>
              <Button
                mode="outlined"
                onPress={handleGeneratePDF}
                style={styles.actionButton}
                loading={pdfGenerating}
                disabled={pdfGenerating}
                icon="file-pdf-box"
              >
                {GEORGIAN_LABELS.generatePDF}
              </Button>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Share FAB */}
      <FAB
        icon="share"
        style={styles.shareFab}
        onPress={handleGeneratePDF}
        loading={pdfGenerating}
        disabled={pdfGenerating}
      />

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>მუშავდება...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  infoCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 16,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  subsectionTitle: {
    marginBottom: 12,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    color: COLORS.text.secondary,
    flex: 1,
  },
  infoValue: {
    color: COLORS.text.primary,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    marginVertical: 16,
  },
  vehicleInfo: {
    alignItems: 'center',
  },
  vehicleModel: {
    fontWeight: 'bold',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  vin: {
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  visualEstimatesCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  estimateCard: {
    elevation: 1,
    marginVertical: 4,
  },
  estimateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  estimateTitle: {
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  estimateAmount: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  repairTypes: {
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  photoAngle: {
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },
  estimateSeparator: {
    height: 8,
  },
  servicesCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  itemHeader: {
    flex: 3,
  },
  quantityHeader: {
    flex: 1,
  },
  priceHeader: {
    flex: 1.5,
  },
  totalHeader: {
    flex: 1.5,
  },
  itemCell: {
    flex: 3,
  },
  quantityCell: {
    flex: 1,
  },
  priceCell: {
    flex: 1.5,
  },
  totalCell: {
    flex: 1.5,
  },
  itemName: {
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  itemSubtext: {
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  damageZone: {
    color: COLORS.primary,
    fontSize: 11,
    marginTop: 2,
  },
  totalAmount: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  totalsCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 3,
    backgroundColor: COLORS.surface,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    color: COLORS.text.primary,
  },
  totalValue: {
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  totalDivider: {
    marginVertical: 12,
  },
  finalTotalLabel: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  finalTotalValue: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  actionsCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    borderColor: COLORS.primary,
  },
  bottomSpacing: {
    height: 80,
  },
  shareFab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: COLORS.primary,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.text.primary,
    fontSize: 16,
  },
});