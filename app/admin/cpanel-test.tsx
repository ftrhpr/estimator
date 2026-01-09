import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Appbar, Text, Button, Card, Divider, ActivityIndicator, Chip } from 'react-native-paper';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { testConnection, batchSyncInvoices, isCPanelConfigured } from '../../src/services/cpanelService';
import { getAllInspections } from '../../src/services/firebase';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../src/config/constants';

export default function CPanelTestScreen() {
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  const configured = isCPanelConfigured();

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await testConnection();
      setTestResult(result);
      
      if (result.success) {
        Alert.alert(
          'Connection Successful! ✅',
          `Database has ${result.data?.transfers_count || 0} records.\nServer time: ${result.data?.server_time || 'N/A'}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Connection Failed ❌',
          result.error || 'Unknown error',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setTesting(false);
    }
  };

  const handleBatchSync = async () => {
    Alert.alert(
      'Batch Sync',
      'This will sync all existing invoices to cPanel. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync All',
          onPress: async () => {
            setSyncing(true);
            setSyncResult(null);
            
            try {
              // Get all invoices from Firebase
              const invoices = await getAllInspections();
              
              if (invoices.length === 0) {
                Alert.alert('No Invoices', 'No invoices found to sync.');
                setSyncing(false);
                return;
              }
              
              // Prepare data for batch sync
              const invoicesToSync = invoices.map(inv => ({
                id: inv.id,
                data: inv,
              }));
              
              // Perform batch sync
              const result = await batchSyncInvoices(invoicesToSync);
              setSyncResult(result);
              
              if (result.success) {
                Alert.alert(
                  'Batch Sync Complete',
                  `Successfully synced: ${result.successCount}\nFailed: ${result.failCount}\nTotal: ${result.total}`,
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert('Sync Failed', result.error || 'Unknown error');
              }
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setSyncing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="cPanel Integration Test" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Configuration Status */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.statusRow}>
              <MaterialCommunityIcons
                name={configured ? 'check-circle' : 'alert-circle'}
                size={24}
                color={configured ? COLORS.success : COLORS.warning}
              />
              <Text style={styles.statusTitle}>Configuration Status</Text>
            </View>
            
            <Text style={styles.statusText}>
              {configured
                ? '✅ cPanel API is configured'
                : '⚠️ cPanel API not configured'}
            </Text>
            
            {!configured && (
              <Text style={styles.helpText}>
                Add EXPO_PUBLIC_CPANEL_API_URL and EXPO_PUBLIC_CPANEL_API_KEY to your .env file
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Test Connection */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Test Connection
            </Text>
            <Text style={styles.cardDescription}>
              Verify that your app can connect to the cPanel server
            </Text>
            
            <Button
              mode="contained"
              onPress={handleTestConnection}
              loading={testing}
              disabled={!configured || testing}
              style={styles.button}
              icon="connection"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
            
            {testResult && (
              <View style={[
                styles.resultBox,
                testResult.success ? styles.resultSuccess : styles.resultError
              ]}>
                <Text style={styles.resultTitle}>
                  {testResult.success ? '✅ Success' : '❌ Failed'}
                </Text>
                {testResult.success && testResult.data && (
                  <>
                    <Text style={styles.resultText}>
                      Database: Connected
                    </Text>
                    <Text style={styles.resultText}>
                      Records: {testResult.data.transfers_count}
                    </Text>
                    <Text style={styles.resultText}>
                      Server Time: {testResult.data.server_time}
                    </Text>
                  </>
                )}
                {!testResult.success && (
                  <Text style={styles.resultText}>
                    Error: {testResult.error}
                  </Text>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Batch Sync */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Batch Sync
            </Text>
            <Text style={styles.cardDescription}>
              Sync all existing invoices from Firebase to cPanel database
            </Text>
            
            <Button
              mode="contained"
              onPress={handleBatchSync}
              loading={syncing}
              disabled={!configured || syncing}
              style={styles.button}
              icon="sync"
            >
              {syncing ? 'Syncing...' : 'Sync All Invoices'}
            </Button>
            
            {syncResult && (
              <View style={[
                styles.resultBox,
                syncResult.success ? styles.resultSuccess : styles.resultError
              ]}>
                <Text style={styles.resultTitle}>
                  {syncResult.success ? '✅ Batch Sync Complete' : '❌ Batch Sync Failed'}
                </Text>
                {syncResult.success && (
                  <>
                    <Text style={styles.resultText}>
                      Total: {syncResult.total}
                    </Text>
                    <Text style={styles.resultText}>
                      Success: {syncResult.successCount}
                    </Text>
                    <Text style={styles.resultText}>
                      Failed: {syncResult.failCount}
                    </Text>
                  </>
                )}
                {!syncResult.success && (
                  <Text style={styles.resultText}>
                    Error: {syncResult.error}
                  </Text>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Information */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              How It Works
            </Text>
            <View style={styles.infoList}>
              <Text style={styles.infoItem}>
                1️⃣ Invoice is created in Firebase (primary)
              </Text>
              <Text style={styles.infoItem}>
                2️⃣ Invoice is automatically synced to cPanel
              </Text>
              <Text style={styles.infoItem}>
                3️⃣ If cPanel sync fails, app continues working
              </Text>
              <Text style={styles.infoItem}>
                4️⃣ Use batch sync to resync all invoices
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    elevation: 2,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.md,
  },
  card: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    elevation: 2,
  },
  cardTitle: {
    color: COLORS.text.primary,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  cardDescription: {
    color: COLORS.text.secondary,
    marginBottom: SPACING.md,
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginLeft: SPACING.sm,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  helpText: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  button: {
    marginTop: SPACING.sm,
  },
  resultBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  resultSuccess: {
    backgroundColor: COLORS.successLight + '20',
    borderColor: COLORS.success,
  },
  resultError: {
    backgroundColor: COLORS.errorLight + '20',
    borderColor: COLORS.error,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    color: COLORS.text.primary,
  },
  resultText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  infoList: {
    marginTop: SPACING.sm,
  },
  infoItem: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
});
