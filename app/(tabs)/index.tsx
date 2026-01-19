import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { Dimensions, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BORDER_RADIUS, COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '../../src/config/constants';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const handleQuickCapture = () => {
    router.push('/capture/QuickCaptureScreen');
  };

  const handleServiceSettings = () => {
    router.push('/services/ServiceSettingsScreen');
  };

  const features = [
    {
      icon: 'barcode-scan',
      title: 'VIN Scanner',
      description: 'Scan vehicle VIN codes instantly',
      color: COLORS.primary,
    },
    {
      icon: 'camera-outline',
      title: 'Photo Assessment',
      description: 'AI-powered damage analysis',
      color: COLORS.secondary,
    },
    {
      icon: 'database-outline',
      title: 'cPanel',
      description: 'View cPanel invoices (admin)',
      color: COLORS.accent,
      onPress: () => router.push('/admin/cpanel-inspections'),
    },
    {
      icon: 'cloud-outline',
      title: 'Cloud Storage',
      description: 'Secure Firebase integration',
      color: COLORS.warning,
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* Hero Section */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryLight]}
        style={styles.heroSection}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.heroContent}>
          <MaterialCommunityIcons 
            name="car-wrench" 
            size={48} 
            color={COLORS.text.onPrimary} 
            style={styles.heroIcon}
          />
          <Text style={styles.heroTitle}>Auto Body Estimator</Text>
          <Text style={styles.heroSubtitle}>
            Professional damage assessment and repair estimation
          </Text>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {/* Quick Capture Button */}
          <TouchableOpacity 
            style={[styles.primaryCard, styles.quickCaptureCard]}
            onPress={handleQuickCapture}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[COLORS.secondary, COLORS.secondaryLight]}
              style={styles.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardContent}>
                <MaterialCommunityIcons 
                  name="camera-plus" 
                  size={32} 
                  color={COLORS.text.onPrimary} 
                />
                <View style={styles.cardText}>
                  <Text style={styles.primaryCardTitle}>New Car</Text>
                  <Text style={styles.primaryCardSubtitle}>
                    Quick photo capture - just walk and snap
                  </Text>
                </View>
                <MaterialCommunityIcons 
                  name="chevron-right" 
                  size={24} 
                  color={COLORS.text.onPrimary} 
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryCard}
            onPress={handleServiceSettings}
            activeOpacity={0.8}
          >
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons 
                  name="cog-outline" 
                  size={28} 
                  color={COLORS.secondary} 
                />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.secondaryCardTitle}>Service Management</Text>
                <Text style={styles.secondaryCardSubtitle}>
                  Manage repair services and pricing
                </Text>
              </View>
              <MaterialCommunityIcons 
                name="chevron-right" 
                size={20} 
                color={COLORS.text.secondary} 
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Features Grid */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Key Features</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => {
              const Wrapper: any = feature.onPress ? TouchableOpacity : View;
              return (
                <Wrapper
                  key={index}
                  style={styles.featureCard}
                  activeOpacity={feature.onPress ? 0.8 : 1}
                  onPress={feature.onPress}
                >
                  <View style={[styles.featureIcon, { backgroundColor: `${feature.color}15` }]}>
                    <MaterialCommunityIcons 
                      name={feature.icon} 
                      size={24} 
                      color={feature.color} 
                    />
                  </View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </Wrapper>
              );
            })}
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Why Choose Our App?</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>95%</Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>5min</Text>
              <Text style={styles.statLabel}>Avg. Time</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>100+</Text>
              <Text style={styles.statLabel}>Services</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      
      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleQuickCapture}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[COLORS.secondary, COLORS.secondaryLight]}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <MaterialCommunityIcons name="camera-plus" size={24} color={COLORS.text.onPrimary} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  heroSection: {
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  heroContent: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
  },
  heroIcon: {
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontWeight: '700',
    color: COLORS.text.onPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.onPrimary,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed * TYPOGRAPHY.fontSize.base,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 100, // Space for FAB
  },
  quickActions: {
    marginBottom: SPACING.xl,
  },
  primaryCard: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  newEstimateCard: {
    // Custom styles for the main card
  },
  quickCaptureCard: {
    marginBottom: SPACING.md,
  },
  cardGradient: {
    borderRadius: BORDER_RADIUS.xl,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  cardText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  primaryCardTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: '600',
    color: COLORS.text.onPrimary,
    marginBottom: 4,
  },
  primaryCardSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.onPrimary,
    opacity: 0.9,
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.sm,
  },
  secondaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCardTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  secondaryCardSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.sm,
  },
  featuresSection: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.lg,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  featureCard: {
    width: (width - SPACING.lg * 2 - SPACING.md) / 2,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  featureTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  featureDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lineHeight.normal * TYPOGRAPHY.fontSize.sm,
  },
  statsSection: {
    marginBottom: SPACING.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  statNumber: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    right: SPACING.lg,
    bottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    ...SHADOWS.lg,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
