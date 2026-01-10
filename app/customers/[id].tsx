import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, Appbar, Card, ActivityIndicator, Chip, Button, IconButton, Portal, Modal, TextInput } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../src/config/constants';
import { getAllInspections, updateInspection } from '../../src/services/firebase';
import { formatCurrencyGEL } from '../../src/utils/helpers';

interface Invoice {
  id: string;
  customerName: string;
  customerPhone: string;
  carModel: string;
  plate?: string;
  totalPrice: number;
  status: string;
  createdAt: string;
  services: any[];
}

export default function CustomerDetailScreen() {
  const { id: customerId } = useLocalSearchParams();
  const customerPhone = customerId as string;
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    loadCustomerData();
  }, [customerPhone]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      const allInspections = await getAllInspections();
      
      // Filter inspections for this customer
      const customerInvoices = allInspections.filter(
        (inv: any) => inv.customerPhone === customerPhone
      );
      
      if (customerInvoices.length > 0) {
        setCustomerName(customerInvoices[0].customerName || 'Unknown');
        
        // Get unique vehicles (prefer plate, fallback to carModel)
        const uniqueVehicles = [...new Set(
          customerInvoices
            .map((inv: any) => inv.plate || inv.carModel)
            .filter((model: string) => model)
        )];
        setVehicles(uniqueVehicles);
        
        // Calculate total spent
        const total = customerInvoices.reduce((sum: number, inv: any) => 
          sum + (inv.totalPrice || 0), 0
        );
        setTotalSpent(total);
        
        // Sort by date (newest first)
        const sorted = customerInvoices.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        setInvoices(sorted);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      Alert.alert('Error', 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditCustomer = () => {
    setEditName(customerName);
    setEditPhone(customerPhone);
    setShowEditModal(true);
  };

  const handleSaveCustomerEdit = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      Alert.alert('Error', 'Please enter customer name and phone number');
      return;
    }
    
    try {
      // Update all invoices for this customer
      for (const invoice of invoices) {
        await updateInspection(invoice.id, {
          customerName: editName.trim(),
          customerPhone: editPhone.trim(),
        });
      }
      
      setCustomerName(editName.trim());
      Alert.alert('Success', 'Customer information updated');
      setShowEditModal(false);
      loadCustomerData();
    } catch (error) {
      console.error('Error updating customer:', error);
      Alert.alert('Error', 'Failed to update customer');
    }
  };

  const handleInvoicePress = (invoiceId: string) => {
    router.push(`/cases/${invoiceId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return COLORS.success;
      case 'in-progress':
        return COLORS.warning;
      case 'draft':
        return COLORS.text.tertiary;
      default:
        return COLORS.primary;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header style={styles.header}>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Customer Details" titleStyle={styles.headerTitle} />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading customer data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Customer Details" titleStyle={styles.headerTitle} />
        <Appbar.Action icon="pencil" onPress={handleEditCustomer} />
        <Appbar.Action icon="refresh" onPress={loadCustomerData} />
      </Appbar.Header>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Customer Info Card */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.customerHeader}>
              <MaterialCommunityIcons name="account-circle" size={64} color={COLORS.primary} />
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{customerName}</Text>
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="phone" size={16} color={COLORS.text.secondary} />
                  <Text style={styles.infoText}>{customerPhone}</Text>
                </View>
              </View>
            </View>

            {vehicles.length > 0 && (
              <View style={styles.vehiclesSection}>
                <Text style={styles.sectionLabel}>Vehicles:</Text>
                <View style={styles.vehiclesContainer}>
                  {vehicles.map((vehicle, index) => (
                    <Chip key={index} icon="car" style={styles.vehicleChip}>
                      {vehicle}
                    </Chip>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{invoices.length}</Text>
                <Text style={styles.statLabel}>Total Invoices</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatCurrencyGEL(totalSpent)}</Text>
                <Text style={styles.statLabel}>Total Spent</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Invoices Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice History</Text>
          
          {invoices.length === 0 ? (
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="file-document-outline" size={48} color={COLORS.text.tertiary} />
                  <Text style={styles.emptyStateText}>No invoices yet</Text>
                </View>
              </Card.Content>
            </Card>
          ) : (
            invoices.map((invoice) => (
              <Card 
                key={invoice.id} 
                style={styles.invoiceCard}
                onPress={() => handleInvoicePress(invoice.id)}
              >
                <Card.Content>
                  <View style={styles.invoiceHeader}>
                    <View style={styles.invoiceInfo}>
                      <View style={styles.invoiceRow}>
                        <MaterialCommunityIcons name="car" size={16} color={COLORS.text.secondary} />
                        <Text style={styles.vehicleText}>{invoice.plate || invoice.carModel}</Text>
                      </View>
                      <View style={styles.invoiceRow}>
                        <MaterialCommunityIcons name="calendar" size={16} color={COLORS.text.secondary} />
                        <Text style={styles.dateText}>{formatDate(invoice.createdAt)}</Text>
                      </View>
                    </View>
                    <Chip
                      mode="flat"
                      style={[styles.statusChip, { backgroundColor: getStatusColor(invoice.status) }]}
                      textStyle={styles.statusText}
                    >
                      {invoice.status || 'Draft'}
                    </Chip>
                  </View>

                  <View style={styles.invoiceDetails}>
                    <View style={styles.servicesInfo}>
                      <MaterialCommunityIcons name="tools" size={16} color={COLORS.text.secondary} />
                      <Text style={styles.servicesText}>
                        {invoice.services.length} service{invoice.services.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={styles.priceText}>{formatCurrencyGEL(invoice.totalPrice)}</Text>
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Edit Customer Modal */}
      <Portal>
        <Modal
          visible={showEditModal}
          onDismiss={() => setShowEditModal(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Customer</Text>
            <IconButton
              icon="close"
              size={20}
              onPress={() => setShowEditModal(false)}
              iconColor={COLORS.text.primary}
            />
          </View>

          <TextInput
            label="Customer Name *"
            value={editName}
            onChangeText={setEditName}
            mode="outlined"
            style={styles.input}
          />

          <TextInput
            label="Phone Number *"
            value={editPhone}
            onChangeText={setEditPhone}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowEditModal(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveCustomerEdit}
              style={styles.modalButton}
              disabled={!editName.trim() || !editPhone.trim()}
            >
              Save Changes
            </Button>
          </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.text.secondary,
  },
  card: {
    marginBottom: SPACING.md,
    elevation: 2,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  customerInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  customerName: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginLeft: 6,
  },
  vehiclesSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  vehiclesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  vehicleChip: {
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: SPACING.md,
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.outline,
  },
  section: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyStateText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.tertiary,
    marginTop: SPACING.sm,
  },
  invoiceCard: {
    marginBottom: SPACING.md,
    elevation: 2,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  vehicleText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginLeft: 6,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginLeft: 6,
  },
  statusChip: {
    height: 28,
  },
  statusText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  invoiceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  servicesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  servicesText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginLeft: 6,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modal: {
    margin: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
  },
  input: {
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  modalButton: {
    minWidth: 100,
  },
});
