import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, IconButton } from 'react-native-paper';
import { Customer } from '../../types';
import { formatPhone } from '../../utils/helpers';
import { COLORS } from '../../config/constants';

interface CustomerCardProps {
  customer: Customer;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  onPress,
  onEdit,
  onDelete,
}) => {
  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content>
        <View style={styles.header}>
          <View style={styles.customerInfo}>
            <Text variant="titleMedium" style={styles.name}>
              {customer.firstName} {customer.lastName}
            </Text>
            <Text variant="bodyMedium" style={styles.contact}>
              {formatPhone(customer.phone)}
            </Text>
            {customer.email && (
              <Text variant="bodySmall" style={styles.email}>
                {customer.email}
              </Text>
            )}
          </View>
          <View style={styles.actions}>
            {onEdit && (
              <IconButton
                icon="pencil"
                size={20}
                onPress={onEdit}
                style={styles.actionButton}
              />
            )}
            {onDelete && (
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerInfo: {
    flex: 1,
  },
  name: {
    fontWeight: 'bold',
    color: COLORS.text.primary,
  },
  contact: {
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  email: {
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    margin: 0,
  },
});