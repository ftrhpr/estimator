import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import {
  Appbar,
  Text,
  Button,
  Card,
  ActivityIndicator,
  Portal,
  Modal,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 60) / 3;

export default function PhotoSelectScreen() {
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Request permissions on component mount
  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Please allow camera and media library access to continue.',
      );
    }
  };

  const selectFromGallery = async () => {
    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled) {
        const newImages = result.assets.map((asset, index) => ({
          id: Date.now() + index,
          uri: asset.uri,
        }));
        setSelectedImages(prevImages => [...prevImages, ...newImages]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select images from gallery');
      console.error('Gallery selection error:', error);
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled) {
        const newImage = {
          id: Date.now(),
          uri: result.assets[0].uri,
        };
        setSelectedImages(prevImages => [...prevImages, newImage]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
      console.error('Camera error:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeImage = (imageId) => {
    setSelectedImages(prevImages => 
      prevImages.filter(image => image.id !== imageId)
    );
  };

  const proceedToTagging = () => {
    if (selectedImages.length === 0) {
      Alert.alert('No Images Selected', 'Please select at least one image to continue.');
      return;
    }

    const imageURIs = selectedImages.map(image => image.uri);
    router.push({
      pathname: '/estimation/TaggingScreen',
      params: { 
        images: JSON.stringify(imageURIs),
        totalImages: selectedImages.length 
      }
    });
  };

  const renderImagePreview = () => {
    if (selectedImages.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons 
            name="image-multiple-outline" 
            size={64} 
            color="#666" 
          />
          <Text style={styles.emptyText}>No images selected</Text>
          <Text style={styles.emptySubtext}>
            Choose photos from gallery or take new ones
          </Text>
        </View>
      );
    }

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.imageScrollContainer}
      >
        {selectedImages.map((image) => (
          <Card key={image.id} style={styles.imageCard}>
            <Image source={{ uri: image.uri }} style={styles.imagePreview} />
            <Button
              mode="contained"
              compact
              style={styles.removeButton}
              onPress={() => removeImage(image.id)}
              icon="close"
              buttonColor="#ff4444"
            />
          </Card>
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Select Photos" />
      </Appbar.Header>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Action Buttons Section */}
        <Card style={styles.actionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Choose Photo Source
            </Text>
            <Text variant="bodyMedium" style={styles.sectionSubtitle}>
              Select photos from gallery or take new ones with camera
            </Text>

            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                style={[styles.actionButton, { flex: 1, marginRight: 8 }]}
                onPress={selectFromGallery}
                icon="image-multiple"
                disabled={loading}
              >
                Select from Gallery
              </Button>

              <Button
                mode="outlined"
                style={[styles.actionButton, { flex: 1, marginLeft: 8 }]}
                onPress={takePhoto}
                icon="camera"
                disabled={loading}
              >
                Take Photos
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Selected Images Counter */}
        {selectedImages.length > 0 && (
          <Card style={styles.counterCard}>
            <Card.Content>
              <View style={styles.counterRow}>
                <MaterialCommunityIcons name="image-outline" size={20} color="#2563EB" />
                <Text style={styles.counterText}>
                  {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Image Preview Section */}
        <Card style={styles.previewCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Selected Images
            </Text>
            {renderImagePreview()}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <Button
          mode="contained"
          style={styles.nextButton}
          onPress={proceedToTagging}
          icon="arrow-right"
          disabled={selectedImages.length === 0 || loading}
          buttonColor="#2563EB"
        >
          Next ({selectedImages.length})
        </Button>
      </View>

      {/* Loading Modal */}
      <Portal>
        <Modal visible={loading} dismissable={false}>
          <View style={styles.loadingModal}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Processing images...</Text>
          </View>
        </Modal>
      </Portal>
    </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  actionCard: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#6b7280',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    paddingVertical: 8,
    borderColor: '#2563EB',
  },
  counterCard: {
    marginBottom: 16,
    elevation: 1,
    backgroundColor: '#eff6ff',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    marginLeft: 8,
    fontWeight: '500',
    color: '#2563EB',
  },
  previewCard: {
    marginBottom: 100,
    elevation: 2,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  imageScrollContainer: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  imageCard: {
    marginHorizontal: 4,
    position: 'relative',
    elevation: 2,
  },
  imagePreview: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    minWidth: 28,
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
  nextButton: {
    paddingVertical: 8,
    borderRadius: 8,
  },
  loadingModal: {
    backgroundColor: 'white',
    padding: 24,
    margin: 32,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#374151',
  },
});