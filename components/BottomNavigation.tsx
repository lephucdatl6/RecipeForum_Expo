import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BottomNavigationProps {
  activeTab: 'profile' | 'forum' | 'recipes' | 'notifications';
  userData?: any;
}

export default function BottomNavigation({ activeTab, userData }: BottomNavigationProps) {
  const navigateToTab = (tab: string) => {
    // Don't navigate if the user clicks on the currently active tab
    if (tab === activeTab) {
      return;
    }
    
    if (!userData) {
      console.warn('BottomNavigation - No userData available!');
      return;
    }
    
    const navigationParams = { userData: JSON.stringify(userData) };
    
    switch (tab) {
      case 'forum':
        router.replace({
          pathname: './RecipesForumScreen',
          params: navigationParams
        });
        break;
      case 'recipes':
        router.replace({
          pathname: './RecipesListScreen',
          params: navigationParams
        });
        break;
      case 'notifications':
        router.replace({
          pathname: './NotificationsScreen',
          params: navigationParams
        });
        break;
      case 'profile':
        router.replace({
          pathname: './MainScreen',
          params: navigationParams
        });
        break;
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => navigateToTab('forum')}
      >
        <View style={styles.iconContainer}>
          <Text style={[styles.icon, activeTab === 'forum' && styles.activeIcon]}>💬</Text>
        </View>
        <Text style={[styles.label, activeTab === 'forum' && styles.activeLabel]}>Forum</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => navigateToTab('recipes')}
      >
        <View style={styles.iconContainer}>
          <Text style={[styles.icon, activeTab === 'recipes' && styles.activeIcon]}>📖</Text>
        </View>
        <Text style={[styles.label, activeTab === 'recipes' && styles.activeLabel]}>Recipes List</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => navigateToTab('notifications')}
      >
        <View style={styles.iconContainer}>
          <Text style={[styles.icon, activeTab === 'notifications' && styles.activeIcon]}>🔔</Text>
        </View>
        <Text style={[styles.label, activeTab === 'notifications' && styles.activeLabel]}>Notifications</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => navigateToTab('profile')}
      >
        <View style={styles.iconContainer}>
          <Text style={[styles.icon, activeTab === 'profile' && styles.activeIcon]}>👤</Text>
        </View>
        <Text style={[styles.label, activeTab === 'profile' && styles.activeLabel]}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingBottom: 20, 
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  icon: {
    fontSize: 24,
    opacity: 0.6,
  },
  activeIcon: {
    opacity: 1,
  },
  label: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  activeLabel: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
