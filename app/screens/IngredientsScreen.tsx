import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
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

interface Ingredient {
  id: number;
  name?: string;
  description?: string;
  price?: number | string;
  package_size?: number;
  package_unit?: string;
  created_at?: string;
  updated_at?: string;
}

export default function IngredientsScreen() {
  const params = useLocalSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingToCart, setAddingToCart] = useState<{[key: number]: boolean}>({});
  const { cartItemCount, loadCartItemCount } = useCart();

  // Order notifications
  useOrderNotifications({ userId: userData?.user_id, enabled: true, userData });

  // Function to handle navigation to cart screen
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

  // Initialize user data from params
  useEffect(() => {
    if (params.userData) {
      try {
        const user = JSON.parse(params.userData as string);
        setUserData(user);
        loadIngredients();
      } catch (error) {
        console.error('Error parsing user data:', error);
        Alert.alert('Error', 'Failed to load user data. Please login again.', [
          {
            text: 'OK',
            onPress: () => router.replace('./LoginScreen')
          }
        ]);
      }
    }
  }, [params.userData]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (userData) {
        loadCartItemCount(userData.user_id);
      }
    }, [userData, loadCartItemCount])
  );

  // Filter ingredients based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredIngredients(ingredients);
    } else {
      const filtered = ingredients.filter(ingredient =>
        (ingredient.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        (ingredient.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
      );
      setFilteredIngredients(filtered);
    }
  }, [searchQuery, ingredients]);

  const loadIngredients = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/ingredients`);
      const data = await response.json();

      if (data.success) {
        // console.log('Ingredients API response:', data.ingredients);
        if (data.ingredients && data.ingredients.length > 0) {
          setIngredients(data.ingredients);
          setFilteredIngredients(data.ingredients);
        } else {
          console.log('No ingredients found in database');
          setIngredients([]);
          setFilteredIngredients([]);
        }
      } else {
        console.error('Error loading ingredients:', data.error);
        Alert.alert('Error', 'Failed to load ingredients. Please try again.');
      }
    } catch (error) {
      console.error('Error loading ingredients:', error);
      Alert.alert('Error', 'Failed to load ingredients. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadIngredients();
    setRefreshing(false);
  }, []);

  const addToCart = async (ingredientId: number) => {
    if (!userData) {
      Alert.alert('Error', 'Please login to add items to cart.');
      return;
    }

    try {
      setAddingToCart(prev => ({ ...prev, [ingredientId]: true }));

      const response = await fetch(`${API_BASE_URL}/api/cart/${userData.user_id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ingredientId: ingredientId,
          quantity: 1
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Find the ingredient name to show in the success message
        const ingredient = ingredients.find(item => item.id === ingredientId);
        const ingredientName = ingredient?.name || 'Item';
        Alert.alert('Success', `${ingredientName} was added to cart!`);
        loadCartItemCount(userData.user_id);
      } else {
        Alert.alert('Error', data.error || 'Failed to add item to cart.');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add item to cart. Please try again.');
    } finally {
      setAddingToCart(prev => ({ ...prev, [ingredientId]: false }));
    }
  };

  const renderIngredientItem = ({ item }: { item: Ingredient }) => (
    <View style={styles.ingredientCard}>
      <View style={styles.ingredientInfo}>
        <Text style={styles.ingredientName}>{item.name || 'Unknown'}</Text>
        <Text style={styles.ingredientDescription}>{item.description || 'No description available'}</Text>
        <Text style={styles.packageSize}>
          {item.package_size ? (Number(item.package_size) % 1 === 0 ? Number(item.package_size).toString() : Number(item.package_size).toFixed(1)) : '0'} {item.package_unit || 'units'}
        </Text>
      </View>
      <View style={styles.priceAndButtonContainer}>
        <Text style={styles.price}>
          ${item.price ? Number(item.price).toFixed(2) : '0.00'}
        </Text>
        <TouchableOpacity
          style={[
            styles.addToCartButton,
            addingToCart[item.id] && styles.addToCartButtonDisabled
          ]}
          onPress={() => addToCart(item.id)}
          disabled={addingToCart[item.id]}
        >
          {addingToCart[item.id] ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="cart" size={16} color="white" />
              <Text style={styles.addToCartText}>Add</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="leaf-outline" size={64} color="#333333" style={{opacity: 0.3}} />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No ingredients found' : 'No ingredients available'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery 
          ? 'Try searching with different keywords' 
          : 'The ingredient database is being set up. Please restart the backend server or check back later.'
        }
      </Text>
      {searchQuery && (
        <TouchableOpacity
          style={styles.clearSearchButton}
          onPress={() => setSearchQuery('')}
        >
          <Text style={styles.clearSearchText}>Clear Search</Text>
        </TouchableOpacity>
      )}
      {!searchQuery && (
        <TouchableOpacity
          style={styles.clearSearchButton}
          onPress={loadIngredients}
        >
          <Text style={styles.clearSearchText}>Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ingredients</Text>
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff8c00" />
          <Text style={styles.loadingText}>Loading ingredients...</Text>
        </View>
        <BottomNavigation activeTab="ingredients" userData={userData} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ingredients</Text>
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

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#333333" style={{opacity: 0.7, marginRight: 12}} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search ingredients..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#888888"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Ionicons name="close-circle" size={20} color="#333333" style={{opacity: 0.7}} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredIngredients}
        renderItem={renderIngredientItem}
        keyExtractor={(item) => item.id.toString()}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      <BottomNavigation activeTab="ingredients" userData={userData} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  header: {
    backgroundColor: 'white',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
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
    backgroundColor: '#FF3B30',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333333',
  },
  clearButton: {
    padding: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  ingredientCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  ingredientInfo: {
    flex: 1,
    marginRight: 16,
  },
  ingredientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  ingredientDescription: {
    fontSize: 14,
    color: '#333333',
    opacity: 0.8,
    marginBottom: 8,
    lineHeight: 20,
  },
  priceAndButtonContainer: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 60,
  },
  packageSize: {
    fontSize: 14,
    color: '#333333',
    opacity: 0.6,
    marginTop: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff8c00',
    marginBottom: 8,
    textAlign: 'right',
  },
  addToCartButton: {
    backgroundColor: '#ff8c00',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  addToCartButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addToCartText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#333333',
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  clearSearchButton: {
    backgroundColor: '#ff8c00',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  clearSearchText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#333333',
    opacity: 0.7,
    marginTop: 16,
  },
});