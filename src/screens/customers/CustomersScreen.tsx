import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Appbar, FAB, Searchbar, Text } from 'react-native-paper';
import { Customer } from '../../types';
import { CustomerService } from '../../services/customerService';
import { CustomerCard } from '../../components/common/CustomerCard';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { COLORS } from '../../config/constants';

export const CustomersScreen: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = customers.filter(customer =>
        customer.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone.includes(searchQuery)
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchQuery, customers]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const customerList = await CustomerService.getAllCustomers();
      setCustomers(customerList);
    } catch (error) {
      console.error('Error loading customers:', error);
      // Handle error (show snackbar, etc.)
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerPress = (customer: Customer) => {
    // Navigate to customer details
    console.log('Navigate to customer details:', customer.id);
  };

  const handleAddCustomer = () => {
    // Navigate to add customer screen
    console.log('Navigate to add customer screen');
  };

  const renderCustomer = ({ item }: { item: Customer }) => (
    <CustomerCard
      customer={item}
      onPress={() => handleCustomerPress(item)}
      onEdit={() => console.log('Edit customer:', item.id)}
      onDelete={() => console.log('Delete customer:', item.id)}
    />
  );

  if (loading) {
    return <LoadingSpinner text="Loading customers..." />;
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Customers" />
      </Appbar.Header>

      <View style={styles.content}>
        <Searchbar
          placeholder="Search customers..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        {filteredCustomers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="titleMedium" style={styles.emptyText}>
              {searchQuery ? 'No customers found' : 'No customers yet'}
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtext}>
              {searchQuery ? 'Try adjusting your search' : 'Add your first customer to get started'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredCustomers}
            renderItem={renderCustomer}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddCustomer}
      />
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
  searchbar: {
    margin: 16,
  },
  listContent: {
    paddingBottom: 80,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: 'center',
    color: COLORS.text.secondary,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: COLORS.primary,
  },
});