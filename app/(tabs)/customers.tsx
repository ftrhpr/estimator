import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, Appbar, Card, Searchbar, FAB, Portal, Modal, TextInput, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../src/config/constants';
import { getAllInspections, createInspection, updateInspection, deleteInspection } from '../../src/services/firebase';
import { formatCurrencyGEL } from '../../src/utils/helpers';

interface Customer {
  id: string;
  name: string;
  phone: string;
  vehicles: string[];
  totalInvoices: number;
  totalSpent: number;
  lastVisit: string;
}

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerVehicle, setCustomerVehicle] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [searchQuery, customers]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const inspections = await getAllInspections();
      
      // Group inspections by customer (based on phone number as unique identifier)
      const customerMap = new Map<string, Customer>();
      
      inspections.forEach((inspection: any) => {
        const phone = inspection.customerPhone || '';
        const name = inspection.customerName || 'Unknown';
        const vehicle = inspection.carModel || '';
        const price = inspection.totalPrice || 0;
        const date = inspection.createdAt || new Date().toISOString();
        
        if (!phone) return; // Skip if no phone number
        
        if (customerMap.has(phone)) {
          const existing = customerMap.get(phone)!;
          existing.totalInvoices += 1;
          existing.totalSpent += price;
          if (vehicle && !existing.vehicles.includes(vehicle)) {
            existing.vehicles.push(vehicle);
          }
          // Update last visit if this inspection is more recent
          if (date > existing.lastVisit) {
            existing.lastVisit = date;
          }
        } else {
          customerMap.set(phone, {
            id: phone, // Use phone as unique ID
            name,
            phone,
            vehicles: vehicle ? [vehicle] : [],
            totalInvoices: 1,
            totalSpent: price,
            lastVisit: date,
          });
        }
      });
      
      const customerList = Array.from(customerMap.values()).sort((a, b) => 
        new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
      );
      
      setCustomers(customerList);
      setFilteredCustomers(customerList);
    } catch (error) {
      console.error('Error loading customers:', error);
      Alert.alert('Error', 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const filterCustomers = () => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = customers.filter(customer => 
      customer.name.toLowerCase().includes(query) ||
      customer.phone.includes(query) ||
      customer.vehicles.some(v => v.toLowerCase().includes(query))
    );
    
    setFilteredCustomers(filtered);
  };

  const handleAddCustomer = () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerVehicle('');
    setShowAddModal(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerVehicle(customer.vehicles[0] || '');
    setShowEditModal(true);
  };

  const handleSaveNewCustomer = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      Alert.alert('Error', 'Please enter customer name and phone number');
      return;
    }
    
    try {
      // Create a placeholder inspection for the new customer
      await createInspection({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        carModel: customerVehicle.trim() || 'Not specified',
        totalPrice: 0,
        services: [],
        parts: [],
        photos: [],
        status: 'draft',
        createdAt: new Date().toISOString(),
      });
      
      Alert.alert('Success', 'Customer added successfully');
      setShowAddModal(false);
      loadCustomers();
    } catch (error) {
      console.error('Error adding customer:', error);
      Alert.alert('Error', 'Failed to add customer');
    }
  };

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer || !customerName.trim() || !customerPhone.trim()) {
      Alert.alert('Error', 'Please enter customer name and phone number');
      return;
    }
    
    try {
      // Update all inspections for this customer
      const inspections = await getAllInspections();
      const customerInspections = inspections.filter(
        (inv: any) => inv.customerPhone === selectedCustomer.phone
      );
      
      for (const inspection of customerInspections) {
        await updateInspection(inspection.id, {
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          // Only update vehicle if a new one is specified and it's the first inspection
          ...(customerVehicle.trim() && inspection.id === customerInspections[0].id 
            ? { carModel: customerVehicle.trim() } 
            : {}),
        });
      }
      
      Alert.alert('Success', 'Customer information updated');
      setShowEditModal(false);
      setSelectedCustomer(null);
      loadCustomers();
    } catch (error) {
      console.error('Error updating customer:', error);
      Alert.alert('Error', 'Failed to update customer');
    }
  };

  const handleDeleteCustomer = (customer: Customer) => {
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${customer.name}? This will also delete all their invoices (${customer.totalInvoices}).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete all inspections for this customer
              const inspections = await getAllInspections();
              const customerInspections = inspections.filter(
                (inv: any) => inv.customerPhone === customer.phone
              );
              
              for (const inspection of customerInspections) {
                await deleteInspection(inspection.id);
              }
              
              Alert.alert('Success', 'Customer and all invoices deleted');
              loadCustomers();
            } catch (error) {
              console.error('Error deleting customer:', error);
              Alert.alert('Error', 'Failed to delete customer');
            }
          },
        },
      ]
    );
  };

  const handleViewCustomer = (customer: Customer) => {
    // Navigate to customer detail page
    router.push(`/customers/${customer.id}`);
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
          <Appbar.Content title="Customers" titleStyle={styles.headerTitle} />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.Content title="Customers" titleStyle={styles.headerTitle} />
        <Appbar.Action icon="refresh" onPress={loadCustomers} />
      </Appbar.Header>

      <View style={styles.content}>
        <Searchbar
          placeholder="Search customers..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {filteredCustomers.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="account-off" size={64} color={COLORS.text.tertiary} />
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No customers found' : 'No customers yet'}
              </Text>
              {!searchQuery && (
                <Button mode="contained" onPress={handleAddCustomer} style={{ marginTop: SPACING.md }}>
                  Add First Customer
                </Button>
              )}
            </View>
          ) : (
            filteredCustomers.map((customer) => (
              <Card key={customer.id} style={styles.customerCard} onPress={() => handleViewCustomer(customer)}>
                <Card.Content>
                  <View style={styles.customerHeader}>
                    <View style={styles.avatarContainer}>
                      <MaterialCommunityIcons name="account-circle" size={48} color={COLORS.primary} />
                    </View>
                    <View style={styles.customerInfo}>
                      <Text style={styles.customerName}>{customer.name}</Text>
                      <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="phone" size={14} color={COLORS.text.secondary} />
                        <Text style={styles.infoText}>{customer.phone}</Text>
                      </View>
                      {customer.vehicles.length > 0 && (
                        <View style={styles.infoRow}>
                          <MaterialCommunityIcons name="car" size={14} color={COLORS.text.secondary} />
                          <Text style={styles.infoText}>{customer.vehicles.join(', ')}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.actionButtons}>
                      <IconButton
                        icon="pencil"
                        size={20}
                        onPress={() => handleEditCustomer(customer)}
                        iconColor={COLORS.primary}
                      />
                      <IconButton
                        icon="delete"
                        size={20}
                        onPress={() => handleDeleteCustomer(customer)}
                        iconColor={COLORS.error}
                      />
                    </View>
                  </View>

                  <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{customer.totalInvoices}</Text>
                      <Text style={styles.statLabel}>Invoices</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{formatCurrencyGEL(customer.totalSpent)}</Text>
                      <Text style={styles.statLabel}>Total Spent</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{formatDate(customer.lastVisit)}</Text>
                      <Text style={styles.statLabel}>Last Visit</Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
        </ScrollView>
      </View>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddCustomer}
        label="Add Customer"
      />

      {/* Add Customer Modal */}
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={() => setShowAddModal(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add New Customer</Text>
            <IconButton
              icon="close"
              size={20}
              onPress={() => setShowAddModal(false)}
              iconColor={COLORS.text.primary}
            />
          </View>

          <TextInput
            label="Customer Name *"
            value={customerName}
            onChangeText={setCustomerName}
            mode="outlined"
            style={styles.input}
          />

          <TextInput
            label="Phone Number *"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
          />

          <TextInput
            label="Vehicle (Optional)"
            value={customerVehicle}
            onChangeText={setCustomerVehicle}
            mode="outlined"
            style={styles.input}
            placeholder="e.g., Toyota Camry 2020"
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowAddModal(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveNewCustomer}
              style={styles.modalButton}
              disabled={!customerName.trim() || !customerPhone.trim()}
            >
              Add Customer
            </Button>
          </View>
        </Modal>
      </Portal>

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
            value={customerName}
            onChangeText={setCustomerName}
            mode="outlined"
            style={styles.input}
          />

          <TextInput
            label="Phone Number *"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
          />

          <TextInput
            label="Primary Vehicle (Optional)"
            value={customerVehicle}
            onChangeText={setCustomerVehicle}
            mode="outlined"
            style={styles.input}
            placeholder="e.g., Toyota Camry 2020"
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
              onPress={handleUpdateCustomer}
              style={styles.modalButton}
              disabled={!customerName.trim() || !customerPhone.trim()}
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
  content: {
    flex: 1,
  },
  searchBar: {
    margin: SPACING.md,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 80,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyStateText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.tertiary,
    marginTop: SPACING.md,
  },
  customerCard: {
    marginBottom: SPACING.md,
    elevation: 2,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  avatarContainer: {
    marginRight: SPACING.sm,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginLeft: 6,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.outline,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
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
  fab: {
    position: 'absolute',
    right: SPACING.md,
    bottom: SPACING.md,
    backgroundColor: COLORS.primary,
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
