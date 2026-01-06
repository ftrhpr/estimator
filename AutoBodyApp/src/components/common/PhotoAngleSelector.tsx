import React, { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Modal, Portal, Card, Text, Button, RadioButton, Divider } from 'react-native-paper';
import { PhotoAngle } from '../../types';
import { COLORS } from '../../config/constants';

interface PhotoAngleSelectorProps {
  visible: boolean;
  onSelect: (angle: PhotoAngle) => void;
  onCancel: () => void;
  selectedAngle?: PhotoAngle;
}

const PHOTO_ANGLES: { value: PhotoAngle; label: string; description: string; icon: string }[] = [
  {
    value: 'Front',
    label: 'Front View',
    description: 'Overall front view of the vehicle',
    icon: '🚗',
  },
  {
    value: 'Side',
    label: 'Side View',
    description: 'Side profile showing damage area',
    icon: '🚙',
  },
  {
    value: 'Rear',
    label: 'Rear View',
    description: 'Overall rear view of the vehicle',
    icon: '🚐',
  },
  {
    value: 'Damage Close-up',
    label: 'Damage Close-up',
    description: 'Detailed view of specific damage',
    icon: '🔍',
  },
];

export const PhotoAngleSelector: React.FC<PhotoAngleSelectorProps> = ({
  visible,
  onSelect,
  onCancel,
  selectedAngle,
}) => {
  const [tempSelection, setTempSelection] = useState<PhotoAngle | undefined>(selectedAngle);

  const handleConfirm = () => {
    if (tempSelection) {
      onSelect(tempSelection);
    }
  };

  const renderAngleOption = ({ item }: { item: typeof PHOTO_ANGLES[0] }) => (
    <Card 
      style={[
        styles.angleCard,
        tempSelection === item.value && styles.selectedCard
      ]}
      onPress={() => setTempSelection(item.value)}
    >
      <Card.Content>
        <View style={styles.angleOption}>
          <View style={styles.angleInfo}>
            <View style={styles.angleHeader}>
              <Text style={styles.angleIcon}>{item.icon}</Text>
              <View style={styles.angleText}>
                <Text variant="titleMedium" style={styles.angleLabel}>
                  {item.label}
                </Text>
                <Text variant="bodySmall" style={styles.angleDescription}>
                  {item.description}
                </Text>
              </View>
            </View>
          </View>
          <RadioButton
            value={item.value}
            status={tempSelection === item.value ? 'checked' : 'unchecked'}
            onPress={() => setTempSelection(item.value)}
          />
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onCancel}
        contentContainerStyle={styles.modalContainer}
      >
        <Card style={styles.selectorCard}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.title}>
              Select Photo Angle
            </Text>
            
            <Text variant="bodyMedium" style={styles.subtitle}>
              Choose the angle that best describes this photo
            </Text>

            <FlatList
              data={PHOTO_ANGLES}
              renderItem={renderAngleOption}
              keyExtractor={(item) => item.value}
              style={styles.angleList}
              showsVerticalScrollIndicator={false}
            />

            <Divider style={styles.divider} />

            <View style={styles.buttonContainer}>
              <Button
                mode="outlined"
                onPress={onCancel}
                style={styles.button}
              >
                Cancel
              </Button>
              
              <Button
                mode="contained"
                onPress={handleConfirm}
                style={[styles.button, styles.confirmButton]}
                disabled={!tempSelection}
              >
                Confirm
              </Button>
            </View>
          </Card.Content>
        </Card>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  selectorCard: {
    maxHeight: '80%',
    elevation: 8,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    color: COLORS.text.primary,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 20,
    color: COLORS.text.secondary,
  },
  angleList: {
    maxHeight: 400,
  },
  angleCard: {
    marginBottom: 8,
    elevation: 1,
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    elevation: 3,
  },
  angleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  angleInfo: {
    flex: 1,
  },
  angleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  angleIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  angleText: {
    flex: 1,
  },
  angleLabel: {
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  angleDescription: {
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  divider: {
    marginVertical: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  button: {
    flex: 1,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
});