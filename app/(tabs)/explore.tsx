import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { View } from 'react-native';

// Deprecated: explore tab removed from the bottom menu. Redirect to home to avoid showing.
export default function ExploreDeprecatedRedirect() {
  useEffect(() => {
    console.warn('Deprecated route visited: /explore — redirecting to /');
    router.replace('/');
  }, []);

  return <View />;
}
