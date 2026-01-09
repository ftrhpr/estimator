import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    ActivityIndicator,
    Appbar,
    Button,
    Card,
    Chip,
    Divider,
    FAB,
    Modal,
    Portal,
    Searchbar,
    Surface,
    Switch,
    Text,
    TextInput,
} from 'react-native-paper';
import { COLORS } from '../../src/config/constants';
import { SERVICE_CATEGORIES } from '../../src/config/services';
import { ServiceService } from '../../src/services/serviceService';
import { Service, ServiceFormData } from '../../src/types';
import { formatCurrencyGEL } from '../../src/utils/helpers';

const { width } = Dimensions.get('window');

// Category icons mapping
const CATEGORY_ICONS: Record<string, string> = {
  bodywork: 'car-wrench',
  painting: 'brush',
  mechanical: 'cog',
  specialized: 'star',
  finishing: 'spray',
};

// Category colors for visual distinction
const CATEGORY_COLORS: Record<string, string> = {
  bodywork: '#3B82F6',
  painting: '#8B5CF6',
  mechanical: '#F59E0B',
  specialized: '#10B981',
  finishing: '#EC4899',
};

export default function ServiceSettingsScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showGeorgian, setShowGeorgian] = useState(true);

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Form state
  const [formData, setFormData] = useState<ServiceFormData>({
    nameEn: '',
    nameKa: '',
    basePrice: '',
    category: 'bodywork',
  });
  const [formErrors, setFormErrors] = useState<Partial<ServiceFormData>>({});

  useEffect(() => {
    initializeAndLoadServices();
  }, []);

  useEffect(() => {
    filterServices();
  }, [searchQuery, services, selectedCategory]);

  const initializeAndLoadServices = async () => {
    try {
      setLoading(true);
      await ServiceService.initializeDefaultServices();
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadServices();
    setRefreshing(false);
  }, []);

  const filterServices = () => {
    let filtered = services;

    if (selectedCategory) {
      filtered = filtered.filter(service => service.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(service =>
        service.nameEn.toLowerCase().includes(query) ||
        service.nameKa.toLowerCase().includes(query)
      );
    }

    setFilteredServices(filtered);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<ServiceFormData> = {};

    if (!formData.nameEn.trim()) {
      newErrors.nameEn = 'English name is required';
    }

    if (!formData.nameKa.trim()) {
      newErrors.nameKa = 'Georgian name is required';
    }

    const price = parseFloat(formData.basePrice);
    if (!formData.basePrice || isNaN(price) || price <= 0) {
      newErrors.basePrice = 'Valid price is required';
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateService = async () => {
    if (!validateForm()) return;

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
      handleCloseForm();
      Alert.alert('✅ Success', 'Service created successfully!');
    } catch (error) {
      console.error('Error creating service:', error);
      Alert.alert('Error', 'Failed to create service. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateService = async () => {
    if (!editingService || !validateForm()) return;

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
      handleCloseForm();
      Alert.alert('✅ Success', 'Service updated successfully!');
    } catch (error) {
      console.error('Error updating service:', error);
      Alert.alert('Error', 'Failed to update service. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteService = (service: Service) => {
    if (service.isDefault) {
      Alert.alert('🔒 Cannot Delete', 'Default services cannot be deleted.');
      return;
    }

    Alert.alert(
      '🗑️ Delete Service',
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
    setFormData({
      nameEn: service.nameEn,
      nameKa: service.nameKa,
      basePrice: service.basePrice.toString(),
      category: service.category,
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleAddService = () => {
    setEditingService(null);
    setFormData({
      nameEn: '',
      nameKa: '',
      basePrice: '',
      category: 'bodywork',
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingService(null);
    setFormData({
      nameEn: '',
      nameKa: '',
      basePrice: '',
      category: 'bodywork',
    });
    setFormErrors({});
  };

  const updateFormField = (field: keyof ServiceFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Statistics
  const totalServices = services.length;
  const activeServices = services.filter(s => s.isActive).length;
  const totalValue = services.reduce((sum, s) => sum + s.basePrice, 0);

  const getCategoryLabel = (categoryValue: string) => {
    const category = SERVICE_CATEGORIES.find(cat => cat.value === categoryValue);
    return showGeorgian ? category?.labelKa || categoryValue : category?.label || categoryValue;
  };

  const renderStatsCard = () => (
    <Surface style={styles.statsContainer} elevation={2}>
      <View style={styles.statItem}>
        <MaterialCommunityIcons name="briefcase" size={24} color={COLORS.primary} />
        <Text style={styles.statValue}>{totalServices}</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.success} />
        <Text style={styles.statValue}>{activeServices}</Text>
        <Text style={styles.statLabel}>Active</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <MaterialCommunityIcons name="cash-multiple" size={24} color={COLORS.warning} />
        <Text style={styles.statValue}>{formatCurrencyGEL(totalValue)}</Text>
        <Text style={styles.statLabel}>Total Value</Text>
      </View>
    </Surface>
  );

  const renderCategoryFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryScroll}
      contentContainerStyle={styles.categoryContainer}
    >
      <Chip
        selected={!selectedCategory}
        onPress={() => setSelectedCategory(null)}
        style={[
          styles.categoryChip,
          !selectedCategory && styles.categoryChipSelected,
        ]}
        textStyle={[
          styles.categoryChipText,
          !selectedCategory && styles.categoryChipTextSelected,
        ]}
        icon={() => (
          <MaterialCommunityIcons
            name="view-grid"
            size={16}
            color={!selectedCategory ? '#fff' : COLORS.text.secondary}
          />
        )}
      >
        All ({services.length})
      </Chip>
      {SERVICE_CATEGORIES.map((category) => {
        const count = services.filter(s => s.category === category.value).length;
        const isSelected = selectedCategory === category.value;
        const color = CATEGORY_COLORS[category.value] || COLORS.primary;
        return (
          <Chip
            key={category.value}
            selected={isSelected}
            onPress={() => setSelectedCategory(isSelected ? null : category.value)}
            style={[
              styles.categoryChip,
              isSelected && { backgroundColor: color },
            ]}
            textStyle={[
              styles.categoryChipText,
              isSelected && styles.categoryChipTextSelected,
            ]}
            icon={() => (
              <MaterialCommunityIcons
                name={CATEGORY_ICONS[category.value] as any || 'tag'}
                size={16}
                color={isSelected ? '#fff' : color}
              />
            )}
          >
            {showGeorgian ? category.labelKa : category.label} ({count})
          </Chip>
        );
      })}
    </ScrollView>
  );

  const renderServiceCard = ({ item }: { item: Service }) => {
    const categoryColor = CATEGORY_COLORS[item.category] || COLORS.primary;

    return (
      <Card
        style={[
          styles.serviceCard,
          !item.isActive && styles.serviceCardInactive,
        ]}
        mode="elevated"
      >
        <View style={[styles.cardAccent, { backgroundColor: categoryColor }]} />
        <Card.Content style={styles.cardContent}>
          <View style={styles.serviceHeader}>
            <View style={styles.serviceIconContainer}>
              <View style={[styles.serviceIcon, { backgroundColor: categoryColor + '20' }]}>
                <MaterialCommunityIcons
                  name={CATEGORY_ICONS[item.category] as any || 'briefcase'}
                  size={24}
                  color={categoryColor}
                />
              </View>
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName} numberOfLines={1}>
                {showGeorgian ? item.nameKa : item.nameEn}
              </Text>
              {showGeorgian && (
                <Text style={styles.serviceNameSecondary} numberOfLines={1}>
                  {item.nameEn}
                </Text>
              )}
              <View style={styles.serviceMetaRow}>
                <Chip
                  style={[styles.categoryTag, { backgroundColor: categoryColor + '15' }]}
                  textStyle={[styles.categoryTagText, { color: categoryColor }]}
                  compact
                >
                  {getCategoryLabel(item.category)}
                </Chip>
                {item.isDefault && (
                  <Chip style={styles.defaultTag} textStyle={styles.defaultTagText} compact>
                    Default
                  </Chip>
                )}
                {!item.isActive && (
                  <Chip style={styles.inactiveTag} textStyle={styles.inactiveTagText} compact>
                    Inactive
                  </Chip>
                )}
              </View>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.priceValue}>{formatCurrencyGEL(item.basePrice)}</Text>
              <Text style={styles.priceLabel}>Base Price</Text>
            </View>
          </View>

          <Divider style={styles.cardDivider} />

          <View style={styles.serviceActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionToggle]}
              onPress={() => handleToggleStatus(item)}
            >
              <MaterialCommunityIcons
                name={item.isActive ? 'pause-circle' : 'play-circle'}
                size={20}
                color={item.isActive ? COLORS.warning : COLORS.success}
              />
              <Text style={[styles.actionText, { color: item.isActive ? COLORS.warning : COLORS.success }]}>
                {item.isActive ? 'Pause' : 'Activate'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionEdit]}
              onPress={() => handleEditService(item)}
            >
              <MaterialCommunityIcons name="pencil" size={20} color={COLORS.primary} />
              <Text style={[styles.actionText, { color: COLORS.primary }]}>Edit</Text>
            </TouchableOpacity>

            {!item.isDefault && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionDelete]}
                onPress={() => handleDeleteService(item)}
              >
                <MaterialCommunityIcons name="delete" size={20} color={COLORS.error} />
                <Text style={[styles.actionText, { color: COLORS.error }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons
        name={searchQuery || selectedCategory ? 'magnify-close' : 'briefcase-plus'}
        size={80}
        color={COLORS.text.disabled}
      />
      <Text style={styles.emptyTitle}>
        {searchQuery || selectedCategory ? 'No services found' : 'No services yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery || selectedCategory
          ? 'Try adjusting your search or filters'
          : 'Add your first service to get started'}
      </Text>
      {!searchQuery && !selectedCategory && (
        <Button
          mode="contained"
          onPress={handleAddService}
          style={styles.emptyButton}
          icon="plus"
        >
          Add Service
        </Button>
      )}
    </View>
  );

  const renderForm = () => (
    <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.formHeader}>
        <MaterialCommunityIcons
          name={editingService ? 'pencil-circle' : 'plus-circle'}
          size={48}
          color={COLORS.primary}
        />
        <Text style={styles.formTitle}>
          {editingService ? 'Edit Service' : 'Add New Service'}
        </Text>
        <Text style={styles.formSubtitle}>
          {editingService ? 'Update service details below' : 'Fill in the service details'}
        </Text>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formLabel}>English Name *</Text>
        <TextInput
          value={formData.nameEn}
          onChangeText={(value) => updateFormField('nameEn', value)}
          style={styles.formInput}
          mode="outlined"
          placeholder="e.g., Paint Repair"
          error={!!formErrors.nameEn}
          disabled={formLoading}
          left={<TextInput.Icon icon="translate" />}
        />
        {formErrors.nameEn && <Text style={styles.formError}>{formErrors.nameEn}</Text>}
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Georgian Name (ქართულად) *</Text>
        <TextInput
          value={formData.nameKa}
          onChangeText={(value) => updateFormField('nameKa', value)}
          style={styles.formInput}
          mode="outlined"
          placeholder="მაგ., საღებავის შეკეთება"
          error={!!formErrors.nameKa}
          disabled={formLoading}
          left={<TextInput.Icon icon="alphabetical" />}
        />
        {formErrors.nameKa && <Text style={styles.formError}>{formErrors.nameKa}</Text>}
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Base Price (₾) *</Text>
        <TextInput
          value={formData.basePrice}
          onChangeText={(value) => updateFormField('basePrice', value)}
          style={styles.formInput}
          mode="outlined"
          placeholder="0.00"
          keyboardType="decimal-pad"
          error={!!formErrors.basePrice}
          disabled={formLoading}
          left={<TextInput.Icon icon="currency-usd" />}
        />
        {formErrors.basePrice && <Text style={styles.formError}>{formErrors.basePrice}</Text>}
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Category *</Text>
        <View style={styles.categoryGrid}>
          {SERVICE_CATEGORIES.map((category) => {
            const isSelected = formData.category === category.value;
            const color = CATEGORY_COLORS[category.value] || COLORS.primary;
            return (
              <TouchableOpacity
                key={category.value}
                style={[
                  styles.categoryOption,
                  isSelected && { borderColor: color, backgroundColor: color + '10' },
                ]}
                onPress={() => updateFormField('category', category.value)}
                disabled={formLoading}
              >
                <MaterialCommunityIcons
                  name={CATEGORY_ICONS[category.value] as any || 'tag'}
                  size={24}
                  color={isSelected ? color : COLORS.text.secondary}
                />
                <Text
                  style={[
                    styles.categoryOptionText,
                    isSelected && { color: color, fontWeight: '600' },
                  ]}
                >
                  {category.labelKa}
                </Text>
                {isSelected && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={18}
                    color={color}
                    style={styles.categoryCheck}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.formButtons}>
        <Button
          mode="outlined"
          onPress={handleCloseForm}
          style={styles.formButton}
          disabled={formLoading}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={editingService ? handleUpdateService : handleCreateService}
          style={styles.formButton}
          loading={formLoading}
          disabled={formLoading}
          icon={editingService ? 'check' : 'plus'}
        >
          {editingService ? 'Update' : 'Create'}
        </Button>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading services...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content
          title="Service Settings"
          titleStyle={styles.headerTitle}
        />
        <View style={styles.languageToggleHeader}>
          <Text style={styles.languageLabel}>EN</Text>
          <Switch
            value={showGeorgian}
            onValueChange={setShowGeorgian}
            color={COLORS.primary}
          />
          <Text style={styles.languageLabel}>ქა</Text>
        </View>
      </Appbar.Header>

      <View style={styles.content}>
        {renderStatsCard()}

        <Searchbar
          placeholder="Search services..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          icon={() => <MaterialCommunityIcons name="magnify" size={22} color={COLORS.text.secondary} />}
          clearIcon={() =>
            searchQuery ? (
              <MaterialCommunityIcons name="close" size={22} color={COLORS.text.secondary} />
            ) : null
          }
        />

        {renderCategoryFilters()}

        {filteredServices.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={filteredServices}
            renderItem={renderServiceCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
          />
        )}
      </View>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddService}
        color="#fff"
        label="Add Service"
      />

      {/* Form Modal */}
      <Portal>
        <Modal
          visible={showForm}
          onDismiss={handleCloseForm}
          contentContainerStyle={styles.modalContainer}
        >
          {renderForm()}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#fff',
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  languageToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  languageLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginHorizontal: 4,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.text.secondary,
    fontSize: 16,
  },

  // Stats Card
  statsContainer: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },

  // Search
  searchbar: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    elevation: 0,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 48,
  },
  searchInput: {
    fontSize: 15,
    paddingLeft: 0,
  },

  // Category Filters
  categoryScroll: {
    maxHeight: 56,
    marginBottom: 12,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 10,
    alignItems: 'center',
  },
  categoryChip: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 4,
    height: 36,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 13,
    color: COLORS.text.primary,
    fontWeight: '500',
    lineHeight: 18,
  },
  categoryChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },

  // Service Cards
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  serviceCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  serviceCardInactive: {
    opacity: 0.7,
  },
  cardAccent: {
    height: 5,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  cardContent: {
    padding: 16,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  serviceIconContainer: {
    marginRight: 12,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  serviceNameSecondary: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  serviceMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  categoryTag: {
    height: 26,
    paddingHorizontal: 2,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
  },
  defaultTag: {
    backgroundColor: '#E0F2FE',
    height: 26,
    paddingHorizontal: 2,
  },
  defaultTagText: {
    fontSize: 11,
    color: '#0369A1',
    lineHeight: 14,
  },
  inactiveTag: {
    backgroundColor: '#FEE2E2',
    height: 26,
    paddingHorizontal: 2,
  },
  inactiveTagText: {
    fontSize: 11,
    color: '#DC2626',
    lineHeight: 14,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  priceLabel: {
    fontSize: 11,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  cardDivider: {
    marginVertical: 12,
  },
  serviceActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  actionToggle: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B20',
  },
  actionEdit: {
    backgroundColor: '#E0E7FF',
    borderWidth: 1,
    borderColor: '#3B82F620',
  },
  actionDelete: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF444420',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    marginTop: 24,
    borderRadius: 12,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Form Modal
  modalContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 40,
    borderRadius: 24,
    maxHeight: '85%',
  },
  formScroll: {
    padding: 24,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginTop: 12,
  },
  formSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#fff',
  },
  formError: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryOption: {
    width: (width - 80) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  categoryOptionText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: COLORS.text.secondary,
  },
  categoryCheck: {
    marginLeft: 4,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  formButton: {
    flex: 1,
    borderRadius: 12,
  },
});