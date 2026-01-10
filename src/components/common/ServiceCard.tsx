import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, IconButton, Chip } from 'react-native-paper';
import { Service } from '../../types';
import { formatCurrency } from '../../utils/helpers';
import { COLORS } from '../../config/constants';
import { SERVICE_CATEGORIES } from '../../config/services';

interface ServiceCardProps {
  service: Service;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleStatus?: () => void;
  showGeorgian?: boolean;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onPress,
  onEdit,
  onDelete,
  onToggleStatus,
  showGeorgian = true,
}) => {
  const getCategoryLabel = (categoryValue: string) => {
    const category = SERVICE_CATEGORIES.find(cat => cat.value === categoryValue);
    return showGeorgian ? category?.labelKa || categoryValue : category?.label || categoryValue;
  };

  return (
    <Card 
      style={[
        styles.card, 
        !service.isActive && styles.inactiveCard
      ]} 
      onPress={onPress}
    >
      <Card.Content>
        <View style={styles.header}>
          <View style={styles.serviceInfo}>
            <Text variant="titleMedium" style={styles.name}>
              {showGeorgian ? service.nameKa : service.nameEn}
            </Text>
            {showGeorgian && (
              <Text variant="bodySmall" style={styles.englishName}>
                {service.nameEn}
              </Text>
            )}
            {service.description && (
              <Text variant="bodySmall" style={styles.description}>
                {service.description}
              </Text>
            )}
            <Text variant="titleSmall" style={styles.price}>
              {formatCurrency(service.basePrice)}
            </Text>
          </View>
          <View style={styles.actions}>
            {onToggleStatus && (
              <IconButton
                icon={service.isActive ? "pause" : "play"}
                size={20}
                onPress={onToggleStatus}
                style={styles.actionButton}
                iconColor={service.isActive ? COLORS.warning : COLORS.success}
              />
            )}
            {onEdit && (
              <IconButton
                icon="pencil"
                size={20}
                onPress={onEdit}
                style={styles.actionButton}
              />
            )}
            {onDelete && !service.isDefault && (
              <IconButton
                icon="delete"
                size={20}
                onPress={onDelete}
                style={styles.actionButton}
                iconColor={COLORS.error}
              />
            )}
          </View>
        </View>
        
        <View style={styles.footer}>
          <Chip 
            style={styles.categoryChip}
            textStyle={styles.chipText}
          >
            {getCategoryLabel(service.category)}
          </Chip>
          {service.isDefault && (
            <Chip 
              style={[styles.chip, styles.defaultChip]}
              textStyle={styles.chipText}
            >
              Default
            </Chip>
          )}
          {!service.isActive && (
            <Chip 
              style={[styles.chip, styles.inactiveChip]}
              textStyle={styles.chipText}
            >
              Inactive
            </Chip>
          )}
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 4,
    marginHorizontal: 8,
    elevation: 2,
  },
  inactiveCard: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  name: {
    fontWeight: 'bold',
    color: COLORS.text.primary,
  },
  englishName: {
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  description: {
    color: COLORS.text.secondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  price: {
    color: COLORS.primary,
    fontWeight: 'bold',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    margin: 0,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    height: 28,
  },
  categoryChip: {
    backgroundColor: COLORS.primary + '20',
    height: 28,
  },
  defaultChip: {
    backgroundColor: COLORS.success + '20',
  },
  inactiveChip: {
    backgroundColor: COLORS.warning + '20',
  },
  chipText: {
    fontSize: 12,
  },
});