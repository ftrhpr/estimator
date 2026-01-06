import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { COLORS } from '../../config/constants';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'large', 
  text = 'Loading...' 
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator 
        animating={true} 
        color={COLORS.primary} 
        size={size} 
      />
      {text && (
        <Text style={styles.text} variant="bodyMedium">
          {text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    marginTop: 16,
    textAlign: 'center',
    color: COLORS.text.secondary,
  },
});