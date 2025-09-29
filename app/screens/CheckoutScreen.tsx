import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../../config/apiConfig';

interface UserData {
  user_id: string;
  username: string;
  email: string;
  dateOfBirth: string;
  phone: string;
  points: number;
  created_at?: string;
}

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
  userEmail: string;
  createdAt: string;
  updatedAt: string;
  items: CartItem[];
  totalItems: number;
  totalPrice: string;
}

interface CheckoutScreenProps {
  userData: UserData;
  cart: Cart;
}

const POINTS_DISCOUNTS = [
  { points: 300, discount: 3 },
  { points: 500, discount: 5 },
  { points: 1000, discount: 10 },
  { points: 15000, discount: 15 }
];

// Helper function to format price - show whole numbers when no cents
const formatPrice = (price: number): string => {
  return price % 1 === 0 ? price.toString() : price.toFixed(2);
};

export default function CheckoutScreen() {
  const params = useLocalSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Credit' | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<{points: number, discount: number} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiscountDropdownOpen, setIsDiscountDropdownOpen] = useState(false);

  // Initialize data from route params
  useEffect(() => {
    const initializeData = () => {
      if (params.userData && params.cart) {
        try {
          const parsedUserData = JSON.parse(params.userData as string);
          const parsedCart = JSON.parse(params.cart as string);
          setUserData(parsedUserData);
          setCart(parsedCart);
          setName(parsedUserData.username || '');
          setIsLoading(false);
        } catch (error) {
          console.error('Error parsing route params:', error);
          Alert.alert('Error', 'Failed to load checkout data', [
            { text: 'OK', onPress: () => router.back() }
          ]);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [params.userData, params.cart]);
  
  const availableDiscounts = POINTS_DISCOUNTS.filter(
    discount => userData && userData.points >= discount.points
  );

  const totalAmount = cart ? parseFloat(cart.totalPrice) : 0;
  const discountAmount = selectedDiscount ? selectedDiscount.discount : 0;
  const finalAmount = Math.max(0, totalAmount - discountAmount);

  // Show loading screen while data is being initialized
  if (isLoading) {
    return (
      <>
        <Stack.Screen 
          options={{
            title: 'Checkout',
            headerStyle: { backgroundColor: '#4CAF50' },
            headerTintColor: 'white',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading checkout...</Text>
        </View>
      </>
    );
  }

  // Show error screen if data is not available
  if (!userData || !cart) {
    return (
      <>
        <Stack.Screen 
          options={{
            title: 'Checkout',
            headerStyle: { backgroundColor: '#4CAF50' },
            headerTintColor: 'white',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to load checkout data</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <View style={styles.backButtonContent}>
              <Ionicons name="chevron-back" size={18} color="white" />
              <Text style={styles.backButtonText}>Go Back</Text>
            </View>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const handleConfirmOrder = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter your address');
      return;
    }
    
    if (!paymentMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    if (!userData || !cart) {
      Alert.alert('Error', 'Missing required data');
      return;
    }

    setIsProcessing(true);

    try {
      const orderData = {
        userEmail: userData.email,
        customer_name: name,
        delivery_address: address,
        payment_method: paymentMethod,
        total_amount: finalAmount,
        points_used: selectedDiscount ? selectedDiscount.points : 0,
        discount_amount: discountAmount,
        cart_items: cart.items,
        status: 'Pending'
      };

      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        throw new Error('Failed to create order');
      }

      const result = await response.json();

      // Clear cart after successful order
      await fetch(`${API_BASE_URL}/api/cart/clear`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userEmail: userData.email }),
      });

      Alert.alert(
        'Order Confirmed!',
        `Your order has been placed successfully. Order ID: ${result.order_id}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to OrderTrackingScreen
              router.replace({
                pathname: './OrderTrackingScreen',
                params: {
                  userData: JSON.stringify(userData)
                }
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating order:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Checkout',
          headerStyle: { backgroundColor: '#4CAF50' },
          headerTintColor: 'white',
          headerTitleStyle: { fontWeight: 'bold' },
          headerBackTitle: 'Cart',
          headerLeft: () => (
            <TouchableOpacity
              style={styles.backButtonHeader}
              onPress={() => router.back()}
            >
              <View style={styles.backButtonHeaderContent}>
                <Ionicons name="chevron-back" size={18} color="white" />
                <Text style={styles.backButtonHeaderText}>Back to Cart</Text>
              </View>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Order Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            
            {/* Cart Items List */}
            <View style={styles.itemsList}>
              {cart?.items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.ingredient_name}</Text>
                    <Text style={styles.itemSize}>
                      {Math.round(item.package_size)} {item.package_unit}
                    </Text>
                  </View>
                  <View style={styles.itemPricing}>
                    <Text style={styles.itemQuantity}>Quantity: {Math.round(item.quantity)}</Text>
                    <Text style={styles.itemPrice}>
                      ${formatPrice(item.ingredient_price * item.quantity)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>${formatPrice(totalAmount)}</Text>
            </View>
            {selectedDiscount && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, styles.discountText]}>
                  Discount ({selectedDiscount.points} points):
                </Text>
                <Text style={[styles.summaryValue, styles.discountText]}>
                  -${formatPrice(discountAmount)}
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>${formatPrice(finalAmount)}</Text>
            </View>
          </View>

          {/* Points Discount */}
          {userData && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Use Points for Discount (Available: {userData.points} points)
              </Text>
              
              {/* Dropdown Button */}
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setIsDiscountDropdownOpen(!isDiscountDropdownOpen)}
              >
                <Text style={styles.dropdownButtonText}>
                  {selectedDiscount 
                    ? `${selectedDiscount.points} points = $${selectedDiscount.discount} off`
                    : 'Select discount option'
                  }
                </Text>
                <View style={styles.dropdownArrow}>
                  <Ionicons 
                    name={isDiscountDropdownOpen ? 'chevron-up' : 'chevron-down'} 
                    size={16} 
                    color="#666" 
                  />
                </View>
              </TouchableOpacity>

              {/* Dropdown Menu */}
              {isDiscountDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  <ScrollView 
                    style={{ maxHeight: 200 }}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                  >
                    {/* No discount option */}
                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        !selectedDiscount && styles.selectedDropdownItem
                      ]}
                      onPress={() => {
                        setSelectedDiscount(null);
                        setIsDiscountDropdownOpen(false);
                      }}
                    >
                      <Text style={[
                        styles.dropdownItemText,
                        !selectedDiscount && styles.selectedDropdownItemText
                      ]}>
                        No discount
                      </Text>
                    </TouchableOpacity>

                    {/* Discount options */}
                    {POINTS_DISCOUNTS.map((discount) => {
                      const hasEnoughPoints = userData.points >= discount.points;
                      const isSelected = selectedDiscount?.points === discount.points;
                      
                      return (
                        <TouchableOpacity
                          key={discount.points}
                          style={[
                            styles.dropdownItem,
                            !hasEnoughPoints && styles.disabledDropdownItem,
                            isSelected && styles.selectedDropdownItem
                          ]}
                          onPress={() => {
                            if (hasEnoughPoints) {
                              setSelectedDiscount(discount);
                              setIsDiscountDropdownOpen(false);
                            }
                          }}
                          disabled={!hasEnoughPoints}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            !hasEnoughPoints && styles.disabledDropdownItemText,
                            isSelected && styles.selectedDropdownItemText
                          ]}>
                            {discount.points} points = ${discount.discount} off
                            {!hasEnoughPoints && ' (Not enough points)'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Customer Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#999"
            />
            <TextInput
              style={[styles.input, styles.addressInput]}
              placeholder="Delivery Address"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              placeholderTextColor="#999"
            />
          </View>

          {/* Payment Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.paymentOptions}>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'Cash' && styles.selectedPaymentOption
                ]}
                onPress={() => setPaymentMethod('Cash')}
              >
                <Text style={[
                  styles.paymentOptionText,
                  paymentMethod === 'Cash' && styles.selectedPaymentOptionText
                ]}>
                  Cash on Delivery
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'Credit' && styles.selectedPaymentOption
                ]}
                onPress={() => setPaymentMethod('Credit')}
              >
                <Text style={[
                  styles.paymentOptionText,
                  paymentMethod === 'Credit' && styles.selectedPaymentOptionText
                ]}>
                  Credit Card
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Order Button */}
          <TouchableOpacity
            style={[styles.confirmButton, isProcessing && styles.disabledButton]}
            onPress={handleConfirmOrder}
            disabled={isProcessing}
          >
            <Text style={styles.confirmButtonText}>
              {isProcessing ? 'Processing...' : 'Confirm Order'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
  },
  discountText: {
    color: '#4CAF50',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  itemsList: {
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  itemSize: {
    fontSize: 14,
    color: '#666',
  },
  itemPricing: {
    alignItems: 'flex-end',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: 'white',
  },
  addressInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  paymentOptions: {
    gap: 8,
  },
  paymentOption: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    backgroundColor: 'white',
  },
  selectedPaymentOption: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f8f0',
  },
  paymentOptionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  selectedPaymentOptionText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopWidth: 0,
    borderRadius: 8,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: 'white',
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedDropdownItem: {
    backgroundColor: '#f0f8f0',
  },
  disabledDropdownItem: {
    backgroundColor: '#f8f8f8',
    opacity: 0.6,
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  selectedDropdownItemText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  disabledDropdownItemText: {
    color: '#999',
  },
  discountOptions: {
    gap: 8,
  },
  discountOption: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  selectedDiscountOption: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f8f0',
  },
  disabledDiscountOption: {
    borderColor: '#ccc',
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
  },
  discountOptionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  selectedDiscountOptionText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  disabledDiscountOptionText: {
    color: '#999',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButtonHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButtonHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonHeaderText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});