import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button as PaperButton, ActivityIndicator } from 'react-native-paper';

export default function Button({ 
  children, 
  onPress, 
  mode = 'contained',
  loading = false,
  disabled = false,
  style = {},
  buttonColor = '#2563EB',
  textColor = 'white',
  icon,
  ...props 
}) {
  return (
    <PaperButton
      mode={mode}
      onPress={onPress}
      disabled={disabled || loading}
      loading={loading}
      style={[styles.button, style]}
      buttonColor={buttonColor}
      textColor={textColor}
      icon={icon}
      {...props}
    >
      {children}
    </PaperButton>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 4,
    borderRadius: 8,
  },
});