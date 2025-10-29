import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { API_BASE_URL } from '../config/apiConfig';
import notificationService from '../utils/notificationService';

interface NotificationContextType {
  startNotifications: (userId: string, userData?: any) => Promise<void>;
  stopNotifications: () => void;
  isActive: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [isActive, setIsActive] = useState(false);
  const [appStateTimeout, setAppStateTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Initialize notification service
    const initializeNotifications = async () => {
      try {
        await notificationService.initialize();
        // console.log('Notification service initialized');
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    initializeNotifications();

    // Handle app state changes with debouncing
    const handleAppStateChange = (nextAppState: string) => {
    //   console.log('App state changed to:', nextAppState);
      
      // Clear any existing timeout
      if (appStateTimeout) {
        clearTimeout(appStateTimeout);
      }
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Stop polling when app goes to background
        notificationService.stopPolling();
        setIsActive(false);
      } else if (nextAppState === 'active' && currentUserId) {
        // Add small delay to prevent rapid successive calls
        const timeout = setTimeout(() => {
          // Resume polling when app becomes active (if user is logged in)
          notificationService.startPolling(currentUserId, API_BASE_URL);
          setIsActive(true);
        }, 100); // 100ms delay
        
        setAppStateTimeout(timeout);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Handle notification tap responses
    const notificationResponseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      // Handle order status notifications
      if (data?.type === 'order_status_update' && data?.orderId) {
        // console.log('Notification tapped, navigating to orders with ID:', data.orderId);
        
        // Navigate to OrderTrackingScreen with user data
        try {
          if (currentUserData) {
            router.push({
              pathname: '/screens/OrderTrackingScreen',
              params: {
                userData: JSON.stringify(currentUserData),
                highlightOrderId: data.orderId.toString(),
              }
            });
          } else {
            // Fallback navigation without user data
            router.push('/screens/OrderTrackingScreen');
          }
        } catch (error) {
          console.error('Failed to navigate from notification:', error);
        }
      }
    });

    return () => {
      subscription?.remove();
      notificationResponseListener.remove();
      notificationService.stopPolling();
      if (appStateTimeout) {
        clearTimeout(appStateTimeout);
      }
    };
  }, [currentUserId]);

  const startNotifications = async (userId: string, userData?: any) => {
    // Prevent duplicate calls for the same user
    if (currentUserId === userId && isActive) {
      // console.log('Notifications already active for user:', userId);
      return;
    }

    // console.log('Starting notifications for user:', userId);
    setCurrentUserId(userId);
    if (userData) {
      setCurrentUserData(userData);
    }

    // Mark existing orders as seen so the user won't get notifications for old orders
    try {
      const maybeFn = (notificationService as any)?.markExistingOrdersAsSeen;

      if (typeof maybeFn === 'function') {
        await maybeFn.call(notificationService, userId, API_BASE_URL);
      } else {
        // Tetch the user orders and cache their statuses in AsyncStorage
        try {
          const response = await fetch(`${API_BASE_URL}/api/orders/userid/${userId}`);
          const data = await response.json();

          if (data.success && Array.isArray(data.orders) && data.orders.length > 0) {
            const sets: Array<[string, string]> = [];
            for (const order of data.orders) {
              const key = `order_${order.order_id}_status`;
              const value = order.status || '';
              sets.push([key, value]);
            }

            if (sets.length > 0) {
              await AsyncStorage.multiSet(sets as [string, string][]);
            }
          }
        } catch (innerErr) {
          console.error('Fallback failed to mark existing orders as seen:', innerErr);
        }
      }
    } catch (error) {
      console.error('Failed to mark existing orders as seen:', error);
    }

    // Only start polling if app is active
    if (AppState.currentState === 'active') {
      notificationService.startPolling(userId, API_BASE_URL);
      setIsActive(true);
    }
  };

  const stopNotifications = () => {
    console.log('Stopping notifications');
    setCurrentUserId(null);
    setCurrentUserData(null);
    notificationService.stopPolling();
    setIsActive(false);
  };

  return (
    <NotificationContext.Provider value={{
      startNotifications,
      stopNotifications,
      isActive
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationProvider;