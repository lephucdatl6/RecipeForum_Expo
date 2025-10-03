import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../../config/apiConfig';
import { useCart } from '../../contexts/CartContext';

interface CartItem {
  id: number;
  quantity: number;
  added_at: string;
  ingredient_id: number;
  ingredient_name: string;
  ingredient_description: string;
  ingredient_price: number;
  package_size: number;
  package_unit: string;
}

interface Cart {
  id: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  items: CartItem[];
  totalItems: number;
  totalPrice: string;
}

interface UserData {
  user_id: string;
  username: string;
  email: string;
  dateOfBirth: string;
  phone: string;
  points: number;
  created_at?: string;
}

export default function ShoppingCartScreen() {
  const params = useLocalSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingItems, setUpdatingItems] = useState<{[key: number]: boolean}>({});
  const { loadCartItemCount } = useCart();

  // Initialize user data from params on first load
  useEffect(() => {
    const initializeUserData = () => {
      if (params.userData) {
        try {
          const user = JSON.parse(params.userData as string);
          setUserData(user);
          loadCart(user.user_id);
          setIsLoading(false);
        } catch (error) {
          console.error('Error parsing user data:', error);
          Alert.alert('Error', 'Failed to load user data. Please login again.', [
            {
              text: 'OK',
              onPress: () => router.replace('./LoginScreen')
            }
          ]);
          setIsLoading(false);
        }
      }
    };

    initializeUserData();
  }, [params.userData]);

  // Refresh cart when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (userData) {
        loadCart(userData.user_id);
      }
    }, [userData])
  );

  const loadCart = async (userId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/cart/${userId}`);
      const data = await response.json();

      if (data.success) {
        setCart(data.cart);
      } else {
        console.error('Error loading cart:', data.error);
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateItemQuantity = async (itemId: number, newQuantity: number) => {
    const quantity = Math.floor(newQuantity);
    
    // If quantity would be 0, show confirmation dialog
    if (quantity <= 0) {
      Alert.alert(
        'Remove Item',
        'Do you want to remove this item from your cart?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeItem(itemId),
          },
        ]
      );
      return;
    }

    setUpdatingItems(prev => ({ ...prev, [itemId]: true }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/cart/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity: quantity
        }),
      });

      const data = await response.json();

      if (data.success && cart) {
        // Update cart state locally instead of reloading from server
        setCart(prevCart => {
          if (!prevCart) return prevCart;
          
          const updatedItems = prevCart.items.map(item => 
            item.id === itemId 
              ? { ...item, quantity: quantity }
              : item
          );
          
          const totalItems = updatedItems.reduce((sum, item) => sum + Math.floor(item.quantity), 0);
          const totalPrice = updatedItems.reduce((sum, item) => 
            sum + (Math.floor(item.quantity) * parseFloat(item.ingredient_price.toString())), 0
          ).toFixed(2);
          
          return {
            ...prevCart,
            items: updatedItems,
            totalItems,
            totalPrice
          };
        });
        
        // Refresh cart count in navigation
        if (userData?.user_id) {
          loadCartItemCount(userData.user_id);
        }
      } else {
        Alert.alert('Error', data.error || 'Failed to update item quantity');
      }
    } catch (error) {
      console.error('Error updating item quantity:', error);
      Alert.alert('Error', 'Failed to update item quantity');
    } finally {
      setUpdatingItems(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const removeItem = async (itemId: number) => {
    setUpdatingItems(prev => ({ ...prev, [itemId]: true }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/cart/items/${itemId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success && userData) {
        loadCart(userData.user_id);
        loadCartItemCount(userData.user_id);
      } else {
        Alert.alert('Error', data.error || 'Failed to remove item');
      }
    } catch (error) {
      console.error('Error removing item:', error);
      Alert.alert('Error', 'Failed to remove item');
    } finally {
      setUpdatingItems(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const clearCart = async () => {
    if (!userData) return;

    Alert.alert(
      'Clear Cart',
      'Are you sure you want to clear all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/cart/${userData.user_id}`, {
                method: 'DELETE',
              });

              const data = await response.json();

              if (data.success) {
                loadCart(userData.user_id);
                loadCartItemCount(userData.user_id);
              } else {
                Alert.alert('Error', data.error || 'Failed to clear cart');
              }
            } catch (error) {
              console.error('Error clearing cart:', error);
              Alert.alert('Error', 'Failed to clear cart');
            }
          }
        }
      ]
    );
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.ingredient_name}</Text>
        <Text style={styles.itemPrice}>${parseFloat(item.ingredient_price.toString()).toFixed(2)} each</Text>
        <Text style={styles.itemDescription}>{item.ingredient_description}</Text>
      </View>
      
      <View style={styles.quantityControls}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateItemQuantity(item.id, Math.floor(item.quantity) - 1)}
          disabled={updatingItems[item.id]}
        >
          <Text style={styles.quantityButtonText}>−</Text>
        </TouchableOpacity>
        
        <View style={styles.quantityDisplay}>
          <Text style={styles.quantityText}>{Math.floor(item.quantity)}</Text>
        </View>
        
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateItemQuantity(item.id, Math.floor(item.quantity) + 1)}
          disabled={updatingItems[item.id]}
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.itemTotal}>
        <Text style={styles.itemTotalText}>
          ${(Math.floor(item.quantity) * parseFloat(item.ingredient_price.toString())).toFixed(2)}
        </Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.centerContainer}>
            <Text>Loading cart...</Text>
          </View>
        </View>
      </>
    );
  }

  if (!userData) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>No user data available</Text>
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => router.replace('./LoginScreen')}
            >
              <Text style={styles.buttonText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.title}>Shopping Cart</Text>
            </View>
            {cart && cart.items.length > 0 && (
              <TouchableOpacity style={styles.clearAllButton} onPress={clearCart}>
                <Text style={styles.clearAllButtonText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

        {cart && cart.items.length > 0 ? (
          <View style={styles.cartCard}>
            <View style={styles.cartHeader}>
              <Text style={styles.itemCount}>{cart.totalItems} items in your cart</Text>
              <Text style={styles.totalPrice}>Total: ${cart.totalPrice}</Text>
            </View>

            <FlatList
              data={cart.items}
              renderItem={renderCartItem}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />

            <View style={styles.checkoutSection}>
              <TouchableOpacity 
                style={styles.checkoutButton}
                onPress={() => router.push({
                  pathname: './CheckoutScreen',
                  params: { 
                    userData: JSON.stringify(userData),
                    cart: JSON.stringify(cart)
                  }
                })}
              >
                <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCartCard}>
            <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
            <Text style={styles.emptyCartSubtitle}>Add some ingredients from recipes to get started!</Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => router.push({
                pathname: './RecipesForumScreen',
                params: { userData: JSON.stringify(userData) }
              })}
            >
              <Text style={styles.browseButtonText}>Browse Recipes</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 10,
    marginRight: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  clearAllButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  clearAllButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cartCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cartHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#28a745',
  },
  separator: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 10,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  itemPrice: {
    fontSize: 14,
    color: '#28a745',
    marginTop: 2,
  },
  itemDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  quantityButton: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,        
    borderRadius: 15,
    backgroundColor: '#f8f8f8',
    minWidth: 30,                
    justifyContent: 'center',
    marginHorizontal: 2,         
  },
  quantityButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
  quantityDisplay: {
    paddingVertical: 4,
    paddingHorizontal: 8,        
    backgroundColor: '#e8f4f8',
    borderRadius: 12,
    minWidth: 30,                
    alignItems: 'center',
    marginHorizontal: 2,         
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  unitText: {
    fontSize: 12,
    color: '#666',
  },
  removeButton: {
    backgroundColor: '#dc3545',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  removeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemTotal: {
    marginLeft: 10,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  itemTotalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  checkoutSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  checkoutButton: {
    backgroundColor: '#28a745',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyCartCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  emptyCartTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyCartSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  browseButton: {
    backgroundColor: '#ff8c00',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  browseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});