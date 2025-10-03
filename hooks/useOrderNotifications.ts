import { useEffect } from 'react';
import { useNotificationContext } from '../contexts/NotificationContext';

interface UseOrderNotificationsProps {
  userId?: string;
  enabled?: boolean;
  userData?: any;
}

// Hook to automatically manage order status notifications
export const useOrderNotifications = ({ userId, enabled = true, userData }: UseOrderNotificationsProps) => {
  const { startNotifications } = useNotificationContext();

  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }

    // Connect to global notification system
    startNotifications(userId, userData);
  }, [userId, enabled, userData, startNotifications]);
};

export default useOrderNotifications;