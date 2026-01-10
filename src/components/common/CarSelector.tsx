/**
 * Car Selector Component
 * Two-step picker for selecting car make and model
 * Georgian language UI with search functionality
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    Button,
    Divider,
    Searchbar,
    Surface,
    Text,
} from 'react-native-paper';

import { COLORS } from '../../config/constants';
import {
    addCustomModel,
    CarMakeDoc,
    CarModelDoc,
    getAllMakes,
    getModelsForMake,
    initializeCarData,
    syncCarDataFromAPI,
} from '../../services/carDbService';

export interface SelectedCar {
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
}

interface CarSelectorProps {
  value?: SelectedCar | null;
  onChange: (car: SelectedCar | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

type SelectionStep = 'make' | 'model';

export const CarSelector: React.FC<CarSelectorProps> = ({
  value,
  onChange,
  placeholder = 'აირჩიეთ მარკა და მოდელი',
  disabled = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState<SelectionStep>('make');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);
  
  // Data
  const [makes, setMakes] = useState<CarMakeDoc[]>([]);
  const [models, setModels] = useState<CarModelDoc[]>([]);
  const [selectedMake, setSelectedMake] = useState<CarMakeDoc | null>(null);
  
  // Initialize and load makes
  useEffect(() => {
    loadMakes();
  }, []);
  
  const loadMakes = async () => {
    try {
      setLoading(true);
      
      // Initialize car data if needed (syncs from API if stale)
      await initializeCarData();
      
      // Load makes from Firebase
      const allMakes = await getAllMakes();
      setMakes(allMakes);
    } catch (error) {
      console.error('Error loading makes:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadModelsForMake = async (makeId: string) => {
    try {
      setLoading(true);
      const makeModels = await getModelsForMake(makeId);
      setModels(makeModels);
    } catch (error) {
      console.error('Error loading models:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSyncFromAPI = async () => {
    try {
      setSyncing(true);
      await syncCarDataFromAPI(true);
      await loadMakes();
    } catch (error) {
      console.error('Error syncing from API:', error);
    } finally {
      setSyncing(false);
    }
  };
  
  const openModal = useCallback(() => {
    setStep('make');
    setSelectedMake(null);
    setSearchQuery('');
    setModalVisible(true);
  }, []);
  
  const closeModal = useCallback(() => {
    setModalVisible(false);
    setSearchQuery('');
  }, []);
  
  const handleSelectMake = useCallback((make: CarMakeDoc) => {
    setSelectedMake(make);
    setStep('model');
    setSearchQuery('');
    loadModelsForMake(make.id);
  }, []);
  
  const handleSelectModel = useCallback((model: CarModelDoc) => {
    if (!selectedMake) return;
    
    onChange({
      makeId: selectedMake.id,
      makeName: selectedMake.name,
      modelId: model.id,
      modelName: model.name,
    });
    
    closeModal();
  }, [selectedMake, onChange, closeModal]);
  
  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);
  
  const handleAddCustomModel = useCallback(async () => {
    if (!selectedMake || !customModelName.trim()) return;
    
    try {
      setSavingCustom(true);
      
      // Save custom model to Firebase
      const newModel = await addCustomModel(
        selectedMake.id,
        selectedMake.name,
        customModelName.trim()
      );
      
      // Select this model
      onChange({
        makeId: selectedMake.id,
        makeName: selectedMake.name,
        modelId: newModel.id,
        modelName: newModel.name,
      });
      
      setCustomModelName('');
      closeModal();
    } catch (error) {
      console.error('Error adding custom model:', error);
    } finally {
      setSavingCustom(false);
    }
  }, [selectedMake, customModelName, onChange, closeModal]);
  
  const handleBack = useCallback(() => {
    setStep('make');
    setSelectedMake(null);
    setSearchQuery('');
  }, []);
  
  // Filter data based on search
  const filteredMakes = searchQuery
    ? makes.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : makes;
  
  const filteredModels = searchQuery
    ? models.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : models;
  
  const renderMakeItem = ({ item }: { item: CarMakeDoc }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => handleSelectMake(item)}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name="car" size={24} color={COLORS.primary} />
      <Text style={styles.listItemText}>{item.name}</Text>
      <MaterialCommunityIcons name="chevron-right" size={24} color="#999" />
    </TouchableOpacity>
  );
  
  const renderModelItem = ({ item }: { item: CarModelDoc }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => handleSelectModel(item)}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name="car-side" size={24} color={COLORS.secondary} />
      <Text style={styles.listItemText}>{item.name}</Text>
      <MaterialCommunityIcons name="check" size={24} color="transparent" />
    </TouchableOpacity>
  );
  
  const displayValue = value 
    ? `${value.makeName} ${value.modelName}`
    : placeholder;
  
  return (
    <>
      {/* Selector Button */}
      <TouchableOpacity
        style={[styles.selector, disabled && styles.selectorDisabled]}
        onPress={openModal}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons 
          name="car" 
          size={22} 
          color={value ? COLORS.primary : '#999'} 
        />
        <Text style={[styles.selectorText, !value && styles.selectorPlaceholder]}>
          {displayValue}
        </Text>
        {value ? (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialCommunityIcons name="close-circle" size={22} color="#999" />
          </TouchableOpacity>
        ) : (
          <MaterialCommunityIcons name="chevron-down" size={22} color="#999" />
        )}
      </TouchableOpacity>
      
      {/* Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <Surface style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            {step === 'model' && (
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            )}
            <Text style={styles.modalTitle}>
              {step === 'make' ? 'აირჩიეთ მარკა' : `${selectedMake?.name} - მოდელი`}
            </Text>
            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          {/* Search */}
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder={step === 'make' ? 'მარკის ძიება...' : 'მოდელის ძიება...'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchBar}
              inputStyle={styles.searchInput}
            />
          </View>
          
          {/* Sync Button */}
          {step === 'make' && (
            <View style={styles.syncContainer}>
              <Button
                mode="text"
                onPress={handleSyncFromAPI}
                loading={syncing}
                icon="sync"
                compact
              >
                სინქრონიზაცია
              </Button>
              <Text style={styles.syncHint}>{makes.length} მარკა</Text>
            </View>
          )}
          
          <Divider />
          
          {/* Custom Model Input - Only shown in model step */}
          {step === 'model' && (
            <View style={styles.customModelContainer}>
              <Text style={styles.customModelLabel}>
                ვერ იპოვეთ მოდელი? ჩაწერეთ ხელით:
              </Text>
              <View style={styles.customModelInputRow}>
                <TextInput
                  style={styles.customModelInput}
                  placeholder="მაგ: Camry, Civic, X5..."
                  placeholderTextColor="#999"
                  value={customModelName}
                  onChangeText={setCustomModelName}
                />
                <TouchableOpacity
                  style={[
                    styles.customModelButton,
                    (!customModelName.trim() || savingCustom) && styles.customModelButtonDisabled
                  ]}
                  onPress={handleAddCustomModel}
                  disabled={!customModelName.trim() || savingCustom}
                >
                  {savingCustom ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <Divider />
          
          {/* List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>იტვირთება...</Text>
            </View>
          ) : (
            <FlatList
              data={step === 'make' ? filteredMakes : filteredModels}
              keyExtractor={(item) => item.id}
              renderItem={step === 'make' ? renderMakeItem : renderModelItem}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <Divider />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="car-off" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'ვერაფერი მოიძებნა' : 'მონაცემები არ არის'}
                  </Text>
                </View>
              }
            />
          )}
        </Surface>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  selectorDisabled: {
    opacity: 0.6,
    backgroundColor: '#f5f5f5',
  },
  selectorText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  selectorPlaceholder: {
    color: '#999',
  },
  
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  
  searchContainer: {
    padding: 12,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  searchInput: {
    fontSize: 15,
  },
  
  syncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  syncHint: {
    fontSize: 13,
    color: '#999',
  },
  
  customModelContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
  },
  customModelLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  customModelInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customModelInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  customModelButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customModelButtonDisabled: {
    backgroundColor: '#ccc',
  },
  
  listContent: {
    paddingBottom: 40,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: '#fff',
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
  },
});

export default CarSelector;
