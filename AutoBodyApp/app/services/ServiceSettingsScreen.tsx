import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Appbar, FAB, Searchbar, Text, Modal, Portal, Switch, List, Divider } from 'react-native-paper';
import { Service, ServiceFormData } from '../../src/types';
import { ServiceService } from '../../src/services/serviceService';
import { ServiceCard } from '../../src/components/common/ServiceCard';
import { ServiceForm } from '../../src/components/forms/ServiceForm';
import { LoadingSpinner } from '../../src/components/common/LoadingSpinner';
import { COLORS } from '../../src/config/constants';
import { SERVICE_CATEGORIES } from '../../src/config/services';

export const ServiceSettingsScreen: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showGeorgian, setShowGeorgian] = useState(true);
  
  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    initializeAndLoadServices();
  }, []);

  useEffect(() => {
    filterServices();
  }, [searchQuery, services, selectedCategory]);

  const initializeAndLoadServices = async () => {
    try {
      setLoading(true);
      // Initialize default services if needed
      await ServiceService.initializeDefaultServices();
      // Load all services
      await loadServices();
    } catch (error) {
      console.error('Error initializing services:', error);
      Alert.alert('Error', 'Failed to load services. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const serviceList = await ServiceService.getAllServices();
      setServices(serviceList);
    } catch (error) {
      console.error('Error loading services:', error);
      Alert.alert('Error', 'Failed to load services.');
    }
  };

  const filterServices = () => {
    let filtered = services;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(service => service.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(service =>
        service.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.nameKa.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredServices(filtered);
  };

  const handleCreateService = async (formData: ServiceFormData) => {
    try {
      setFormLoading(true);
      const serviceData = {
        key: formData.nameEn.toLowerCase().replace(/\s+/g, '_'),
        nameEn: formData.nameEn.trim(),
        nameKa: formData.nameKa.trim(),
        basePrice: parseFloat(formData.basePrice),
        category: formData.category as Service['category'],
        isActive: true,
      };

      await ServiceService.createService(serviceData);
      await loadServices();
      setShowForm(false);
      Alert.alert('Success', 'Service created successfully!');
    } catch (error) {
      console.error('Error creating service:', error);
      Alert.alert('Error', 'Failed to create service. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateService = async (formData: ServiceFormData) => {
    if (!editingService) return;

    try {
      setFormLoading(true);
      const updates = {
        nameEn: formData.nameEn.trim(),
        nameKa: formData.nameKa.trim(),
        basePrice: parseFloat(formData.basePrice),
        category: formData.category as Service['category'],
      };

      await ServiceService.updateService(editingService.id, updates);
      await loadServices();
      setShowForm(false);
      setEditingService(null);
      Alert.alert('Success', 'Service updated successfully!');
    } catch (error) {
      console.error('Error updating service:', error);
      Alert.alert('Error', 'Failed to update service. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteService = (service: Service) => {
    if (service.isDefault) {
      Alert.alert('Cannot Delete', 'Default services cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete Service',
      `Are you sure you want to delete "${showGeorgian ? service.nameKa : service.nameEn}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ServiceService.deleteService(service.id);
              await loadServices();
              Alert.alert('Success', 'Service deleted successfully!');
            } catch (error) {
              console.error('Error deleting service:', error);
              Alert.alert('Error', 'Failed to delete service.');
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (service: Service) => {
    try {
      await ServiceService.toggleServiceStatus(service.id);
      await loadServices();
    } catch (error) {
      console.error('Error toggling service status:', error);
      Alert.alert('Error', 'Failed to update service status.');
    }
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setShowForm(true);
  };

  const handleAddService = () => {
    setEditingService(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingService(null);
  };

  const renderService = ({ item }: { item: Service }) => (
    <ServiceCard
      service={item}
      onPress={() => console.log('Service pressed:', item.id)}
      onEdit={() => handleEditService(item)}
      onDelete={() => handleDeleteService(item)}
      onToggleStatus={() => handleToggleStatus(item)}
      showGeorgian={showGeorgian}
    />
  );

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <View style={styles.languageToggle}>
        <Text variant="labelMedium">Georgian Names</Text>
        <Switch
          value={showGeorgian}
          onValueChange={setShowGeorgian}
        />
      </View>
      
      <Divider style={styles.divider} />
      
      <Text variant="titleSmall" style={styles.filterTitle}>Filter by Category</Text>
      
      <List.Item
        title="All Categories"
        left={() => <List.Icon icon="all-inclusive" />}
        onPress={() => setSelectedCategory(null)}
        style={!selectedCategory ? styles.selectedFilter : undefined}
      />
      
      {SERVICE_CATEGORIES.map((category) => (
        <List.Item
          key={category.value}
          title={showGeorgian ? category.labelKa : category.label}
          left={() => <List.Icon icon="tag" />}
          onPress={() => setSelectedCategory(category.value)}
          style={selectedCategory === category.value ? styles.selectedFilter : undefined}
        />
      ))}
    </View>
  );

  if (loading) {
    return <LoadingSpinner text="Loading services..." />;
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="Service Settings" />
        <Appbar.Action
          icon="filter"
          onPress={() => setShowFilters(true)}
        />
      </Appbar.Header>

      <View style={styles.content}>
        <Searchbar
          placeholder="Search services..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        {filteredServices.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="titleMedium" style={styles.emptyText}>
              {searchQuery || selectedCategory ? 'No services found' : 'No services yet'}
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtext}>
              {searchQuery || selectedCategory 
                ? 'Try adjusting your search or filters' 
                : 'Add your first service to get started'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredServices}
            renderItem={renderService}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddService}
      />

      {/* Service Form Modal */}
      <Portal>
        <Modal
          visible={showForm}
          onDismiss={handleCloseForm}
          contentContainerStyle={styles.modalContainer}
        >
          <ServiceForm
            service={editingService || undefined}
            onSubmit={editingService ? handleUpdateService : handleCreateService}
            onCancel={handleCloseForm}
            loading={formLoading}
          />
        </Modal>
      </Portal>

      {/* Filters Modal */}
      <Portal>
        <Modal
          visible={showFilters}
          onDismiss={() => setShowFilters(false)}
          contentContainerStyle={styles.filtersModal}
        >
          {renderFilters()}
        </Modal>
      </Portal>
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  filtersModal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  filtersContainer: {
    padding: 16,
  },
  languageToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  divider: {
    marginVertical: 16,
  },
  filterTitle: {
    marginBottom: 8,
    color: COLORS.text.primary,
  },
  selectedFilter: {
    backgroundColor: COLORS.primary + '20',
  },
});