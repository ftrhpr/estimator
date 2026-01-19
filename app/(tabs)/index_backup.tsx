import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { View } from 'react-native';

// Deprecated backup index — redirect to main index to avoid exposing in menus
export default function IndexBackupRedirect() {
  useEffect(() => {
    console.warn('Deprecated route visited: /index_backup — redirecting to /');
    router.replace('/');
  }, []);

  return <View />;
}