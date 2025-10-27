import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomNavigation from '../../components/BottomNavigation';
import { API_BASE_URL } from '../../config/apiConfig';
import { useCart } from '../../contexts/CartContext';
import useOrderNotifications from '../../hooks/useOrderNotifications';

interface UserData {
  user_id: string;
  username: string;
  email: string;
  dateOfBirth: string;
  phone: string;
  points: number;
  created_at?: string;
}

interface OrderItem {
  ingredient_id: number;
  ingredient_name: string;
  quantity: number;
  package_type: string;
  price_per_unit: string;
  total_price: string;
}

interface Order {
  order_id: number;
  user_id: string;
  customer_name: string;
  delivery_address: string;
  payment_method: string;
  total_amount: string;
  points_used: number;
  discount_amount: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_email: string;
  username: string;
  item_count: string;
  items?: OrderItem[];
}

export default function OrderTrackingScreen() {
  const params = useLocalSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const { cartItemCount, loadCartItemCount } = useCart();

  // Order notifications
  useOrderNotifications({ userId: userData?.user_id, enabled: true, userData });

  const handleCartNavigation = () => {
    if (!userData) {
      Alert.alert('Login Required', 'Please log in to view your cart.');
      return;
    }
    
    router.push({
      pathname: './ShoppingCartScreen',
      params: {
        userData: JSON.stringify(userData)
      }
    });
  };

  useEffect(() => {
    if (params.userData) {
      try {
        const user = JSON.parse(params.userData as string);
        setUserData(user);
      } catch (error) {
        console.error('Error parsing user data:', error);
        Alert.alert('Error', 'Failed to load user data. Please try again.');
      }
    } else {
      console.log('OrderTracking - No user data available');
    }
  }, [params.userData]);

  // Handle highlighted order from notification
  useEffect(() => {
    if (params.highlightOrderId) {
      setHighlightedOrderId(params.highlightOrderId as string);
      // Auto-expand the highlighted order
      setExpandedOrder(parseInt(params.highlightOrderId as string));
      
      // Clear highlight after 3 seconds
      setTimeout(() => {
        setHighlightedOrderId(null);
      }, 3000);
    }
  }, [params.highlightOrderId]);

  useEffect(() => {
    if (userData?.user_id) {
      loadCartItemCount(userData.user_id);
      loadUserOrders();
    }
  }, [userData?.user_id, loadCartItemCount]);

  useFocusEffect(
    useCallback(() => {
      if (userData?.user_id) {
        loadCartItemCount(userData.user_id);
        loadUserOrders();
      }
    }, [userData?.user_id, loadCartItemCount])
  );

  const loadUserOrders = async () => {
    if (!userData?.user_id) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/orders/userid/${userData.user_id}`);
      const data = await response.json();
      
      if (data.success) {
        const newOrders = data.orders || [];
        setOrders(newOrders);
      } else {
        console.error('Failed to load orders:', data.error);
        Alert.alert('Error', 'Failed to load your orders');
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      Alert.alert('Error', 'Failed to load your orders');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserOrders();
    setRefreshing(false);
  };

  const toggleOrderDetails = async (orderId: number) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/items`);
      const data = await response.json();
      
      if (data.success) {
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.order_id === orderId 
              ? { ...order, items: data.items }
              : order
          )
        );
        setExpandedOrder(orderId);
      } else {
        Alert.alert('Error', 'Failed to load order details');
      }
    } catch (error) {
      console.error('Error loading order details:', error);
      Alert.alert('Error', 'Failed to load order details');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return '#FF9800';
      case 'preparing': return '#FFC107';
      case 'shipped': return '#2196F3';
      case 'arrived': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#666';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canCancelOrder = (order: Order) => {
    // Check if status allows cancellation
    const cancellableStatuses = ['pending'];
    if (!cancellableStatuses.includes(order.status.toLowerCase())) {
      return false;
    }

    // Check if within 30 minutes
    const orderTime = new Date(order.created_at);
    const currentTime = new Date();
    const timeDiffMinutes = (currentTime.getTime() - orderTime.getTime()) / (1000 * 60);
    
    return timeDiffMinutes <= 30;
  };

  const cancelOrder = async (orderId: number) => {
    if (!userData?.user_id) return;

    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/cancel`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: userData.user_id
                }),
              });

              const data = await response.json();

              if (data.success) {
                Alert.alert('Success', 'Order cancelled successfully');
                
                // Refresh orders list
                loadUserOrders();
              } else {
                Alert.alert('Error', data.error || 'Failed to cancel order');
              }
            } catch (error) {
              console.error('Error cancelling order:', error);
              Alert.alert('Error', 'Failed to cancel order');
            }
          }
        }
      ]
    );
  };

  const renderOrderCard = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <TouchableOpacity onPress={() => toggleOrderDetails(item.order_id)}>
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderId}>Order #{item.order_id}</Text>
            <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        
        <View style={styles.orderSummary}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address:</Text>
            <Text style={styles.infoValue}>{item.delivery_address}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment:</Text>
            <Text style={styles.infoValue}>{item.payment_method}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.itemCount}>{item.item_count} item(s)</Text>
            <Text style={styles.totalAmount}>${parseFloat(item.total_amount).toFixed(2)}</Text>
          </View>
          {parseFloat(item.discount_amount) > 0 && (
            <Text style={styles.discount}>Discount: -${parseFloat(item.discount_amount).toFixed(2)}</Text>
          )}
          
          {canCancelOrder(item) && (
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => cancelOrder(item.order_id)}
            >
              <Text style={styles.cancelButtonText}>Cancel Order</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={styles.expandHint}>
          {expandedOrder === item.order_id ? 'Tap to hide details' : 'Tap to view details'}
        </Text>
      </TouchableOpacity>

      {expandedOrder === item.order_id && item.items && (
        <View style={styles.orderDetails}>
          <Text style={styles.detailsTitle}>Order Items:</Text>
          {item.items.map((orderItem, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>
                  {Math.round(orderItem.quantity)}x {orderItem.ingredient_name}
                </Text>
                <Text style={styles.itemPackage}>
                  {orderItem.package_type.replace(/(\d+)\.00/g, (match, num) => Math.round(parseFloat(num)).toString())}
                </Text>
              </View>
              <Text style={styles.itemPrice}>
                ${parseFloat(orderItem.total_price).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No Orders Yet</Text>
      <Text style={styles.emptyDescription}>
        Your order history will appear here once you place your first order from the shopping cart.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>My Orders</Text>
          <Text style={styles.subtitle}>
            Track your order status and history
          </Text>
        </View>
        <TouchableOpacity style={styles.cartButton} onPress={handleCartNavigation}>
          <View style={styles.cartIconContainer}>
            <Ionicons name="cart-outline" size={24} color="#333333" style={{opacity: 0.7}} />
            {cartItemCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {Math.floor(cartItemCount) > 99 ? '99+' : Math.floor(cartItemCount)}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item.order_id.toString()}
        contentContainerStyle={[
          styles.listContainer,
          orders.length === 0 && styles.emptyListContainer
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#ff8c00']}
          />
        }
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
      />
      
      <BottomNavigation activeTab="orders" userData={userData} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 51, 51, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
  },
  cartButton: {
    padding: 8,
  },
  cartIconContainer: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#FF3b30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(51, 51, 51, 0.7)',
    marginTop: 5,
  },
  listContainer: {
    padding: 15,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDate: {
    fontSize: 14,
    color: 'rgba(51, 51, 51, 0.6)',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  orderSummary: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    minWidth: 20,
  },
  infoValue: {
    fontSize: 14,
    color: 'rgba(51, 51, 51, 0.7)',
    flex: 1,
    marginLeft: 8,
  },
  customerName: {
    fontSize: 14,
    color: 'rgba(51, 51, 51, 0.7)',
    marginBottom: 4,
  },
  paymentMethod: {
    fontSize: 14,
    color: 'rgba(51, 51, 51, 0.7)',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 14,
    color: 'rgba(51, 51, 51, 0.7)',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff8c00',
  },
  discount: {
    fontSize: 14,
    color: '#ff8c00',
    marginTop: 4,
  },
  cancelButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  expandHint: {
    fontSize: 12,
    color: 'rgba(51, 51, 51, 0.5)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  orderDetails: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 51, 51, 0.1)',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 51, 51, 0.05)',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  itemPackage: {
    fontSize: 12,
    color: 'rgba(51, 51, 51, 0.6)',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'rgba(51, 51, 51, 0.7)',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: 'rgba(51, 51, 51, 0.7)',
    textAlign: 'center',
    lineHeight: 24,
  },
});
