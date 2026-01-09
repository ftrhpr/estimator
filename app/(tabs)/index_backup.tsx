import React from 'react';
import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
      <Text style={{ fontSize: 24, color: 'blue' }}>Hello World!</Text>
      <Text style={{ fontSize: 16, color: 'gray', marginTop: 10 }}>App is running</Text>
    </View>
  );
}