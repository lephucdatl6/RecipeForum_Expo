import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface OrderStatusNotification {
  orderId: number;
  status: string;
  previousStatus?: string;
}

class NotificationService {
  private isInitialized = false;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private currentUserId: string | null = null;
  private isPolling = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Request permissions for notifications
      await this.requestPermissions();
      this.isInitialized = true;
    //   console.log('NotificationService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NotificationService:', error);
    }
  }

  private async requestPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return false;
    }

    // For iOS, configure notification categories
    if (Platform.OS === 'ios') {
      await Notifications.setNotificationCategoryAsync('order_status', [
        {
          identifier: 'view_order',
          buttonTitle: 'View Order',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);
    }

    return true;
  }

  async scheduleOrderStatusNotification(data: OrderStatusNotification) {
    try {
      const { orderId, status, previousStatus } = data;
      
      // Store the current status to compare later
      await AsyncStorage.setItem(`order_${orderId}_status`, status);

      const notificationContent = this.getNotificationContent(status, orderId);
      
      // Schedule immediate notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notificationContent.title,
          body: notificationContent.body,
          data: {
            orderId,
            status,
            previousStatus,
            type: 'order_status_update',
          },
          categoryIdentifier: Platform.OS === 'ios' ? 'order_status' : undefined,
          sound: 'notification.wav',
        },
        trigger: null, // Show immediately
      });

    //   console.log(`Notification scheduled for order ${orderId}: ${status}`);
    } catch (error) {
      console.error('Failed to schedule notification:', error);
    }
  }

  private getNotificationContent(status: string, orderId: number) {
    const statusLower = status.toLowerCase();
    
    switch (statusLower) {
      case 'pending':
        return {
          title: 'Order Confirmed',
          body: `Your order #${orderId} has been confirmed and is pending preparation.`,
        };
      case 'preparing':
        return {
          title: 'Order Being Prepared',
          body: `Great news! Your order #${orderId} is now being prepared with care.`,
        };
      case 'shipped':
        return {
          title: 'Order Shipped',
          body: `Your order #${orderId} is on its way! Track your delivery progress.`,
        };
      case 'arrived':
        return {
          title: 'Order Delivered',
          body: `Your order #${orderId} has been delivered. Enjoy your ingredients!`,
        };
      case 'cancelled':
        return {
          title: 'Order Cancelled',
          body: `Your order #${orderId} has been cancelled. If you have questions, please contact support.`,
        };
      default:
        return {
          title: 'Order Update',
          body: `Your order #${orderId} status has been updated to ${status}.`,
        };
    }
  }

  async checkForStatusChanges(orders: any[]) {
    try {
      for (const order of orders) {
        const storedStatus = await AsyncStorage.getItem(`order_${order.order_id}_status`);
        
        if (storedStatus && storedStatus !== order.status) {
          // Status has changed, send notification
          await this.scheduleOrderStatusNotification({
            orderId: order.order_id,
            status: order.status,
            previousStatus: storedStatus,
          });
        } else if (!storedStatus) {
          // First time seeing this order, send notification and store status
          await this.scheduleOrderStatusNotification({
            orderId: order.order_id,
            status: order.status,
            previousStatus: undefined,
          });
          await AsyncStorage.setItem(`order_${order.order_id}_status`, order.status);
        }
      }
    } catch (error) {
      console.error('Failed to check for status changes:', error);
    }
  }

  async clearOrderStatusCache(orderId?: number) {
    try {
      if (orderId) {
        await AsyncStorage.removeItem(`order_${orderId}_status`);
      } else {
        // Clear all order status cache
        const keys = await AsyncStorage.getAllKeys();
        const orderStatusKeys = keys.filter(key => key.startsWith('order_') && key.endsWith('_status'));
        await AsyncStorage.multiRemove(orderStatusKeys);
      }
    } catch (error) {
      console.error('Failed to clear order status cache:', error);
    }
  }

  // Get notification history (for debugging)
  async getScheduledNotifications() {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to get scheduled notifications:', error);
      return [];
    }
  }

  // Cancel all notifications for a specific order
  async cancelOrderNotifications(orderId: number) {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      for (const notification of scheduledNotifications) {
        if (notification.content.data?.orderId === orderId) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
      
      console.log(`Cancelled notifications for order ${orderId}`);
    } catch (error) {
      console.error('Failed to cancel order notifications:', error);
    }
  }

  // Set up notification response listener
  setupNotificationResponseListener() {
    return Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data?.type === 'order_status_update') {
        console.log('User tapped notification for order:', data.orderId);
      }
    });
  }

  // Start automatic polling for order status changes
  async startPolling(userId: string, apiBaseUrl: string) {
    if (this.isPolling && this.currentUserId === userId) {
    //   console.log('Polling already active for user:', userId);
      return;
    }

    this.stopPolling(); // Stop any existing polling
    this.currentUserId = userId;
    this.isPolling = true;

    // console.log('Starting order status polling for user:', userId);

    const pollOrders = async () => {
      if (!this.isPolling || !this.currentUserId) return;

      try {
        const response = await fetch(`${apiBaseUrl}/api/orders/userid/${this.currentUserId}`);
        const data = await response.json();
        
        if (data.success && data.orders) {
          await this.checkForStatusChanges(data.orders);
        }
      } catch (error) {
        console.error('Error polling order status:', error);
      }
    };

    // Poll immediately, then every 10 seconds
    await pollOrders();
    this.pollingInterval = setInterval(pollOrders, 10000);
  }

  // Stop automatic polling
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    this.currentUserId = null;
    // console.log('Stopped order status polling');
  }

  // Check if polling is active
  isPollingActive() {
    return this.isPolling && this.pollingInterval !== null;
  }

  // Get current polling status info
  getPollingStatus() {
    return {
      isActive: this.isPolling,
      userId: this.currentUserId,
      hasInterval: this.pollingInterval !== null,
    };
  }
}

export const notificationService = new NotificationService();
export default notificationService;