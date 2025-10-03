import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCart } from '../contexts/CartContext';

interface BottomNavigationProps {
  activeTab: 'profile' | 'forum' | 'bookmarks' | 'orders' | 'cart' | 'ingredients';
  userData?: any;
}

export default function BottomNavigation({ activeTab, userData }: BottomNavigationProps) {
  const { cartItemCount } = useCart();
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
      case 'bookmarks':
        router.replace({
          pathname: './BookmarkScreen',
          params: navigationParams
        });
        break;
      case 'orders':
        router.replace({
          pathname: './OrderTrackingScreen',
          params: navigationParams
        });
        break;
      case 'profile':
        router.replace({
          pathname: './UserProfileScreen',
          params: navigationParams
        });
        break;
      case 'cart':
        router.replace({
          pathname: './ShoppingCartScreen',
          params: navigationParams
        });
        break;
      case 'ingredients':
        router.replace({
          pathname: './IngredientsScreen',
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
          <Ionicons 
            name={activeTab === 'forum' ? 'chatbubbles' : 'chatbubbles-outline'} 
            size={24} 
            color={activeTab === 'forum' ? '#ff8c00' : '#666'} 
          />
        </View>
        <Text style={[styles.label, activeTab === 'forum' && styles.activeLabel]}>Forum</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => navigateToTab('bookmarks')}
      >
        <View style={styles.iconContainer}>
          <Ionicons 
            name={activeTab === 'bookmarks' ? 'bookmark' : 'bookmark-outline'} 
            size={24} 
            color={activeTab === 'bookmarks' ? '#ff8c00' : '#666'} 
          />
        </View>
        <Text style={[styles.label, activeTab === 'bookmarks' && styles.activeLabel]}>Bookmarks</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => navigateToTab('ingredients')}
      >
        <View style={styles.iconContainer}>
          <Ionicons 
            name={activeTab === 'ingredients' ? 'leaf' : 'leaf-outline'} 
            size={24} 
            color={activeTab === 'ingredients' ? '#ff8c00' : '#666'} 
          />
        </View>
        <Text style={[styles.label, activeTab === 'ingredients' && styles.activeLabel]}>Ingredients</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => navigateToTab('cart')}
      >
        <View style={styles.iconContainer}>
          <Ionicons 
            name={activeTab === 'cart' ? 'cart' : 'cart-outline'} 
            size={24} 
            color={activeTab === 'cart' ? '#ff8c00' : '#666'} 
          />
          {cartItemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.label, activeTab === 'cart' && styles.activeLabel]}>Cart</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => navigateToTab('orders')}
      >
        <View style={styles.iconContainer}>
          <Ionicons 
            name={activeTab === 'orders' ? 'bag' : 'bag-outline'} 
            size={24} 
            color={activeTab === 'orders' ? '#ff8c00' : '#666'} 
          />
        </View>
        <Text style={[styles.label, activeTab === 'orders' && styles.activeLabel]}>Orders</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => navigateToTab('profile')}
      >
        <View style={styles.iconContainer}>
          <Ionicons 
            name={activeTab === 'profile' ? 'person' : 'person-outline'} 
            size={24} 
            color={activeTab === 'profile' ? '#ff8c00' : '#666'} 
          />
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
  label: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  activeLabel: {
    color: '#ff8c00',
    fontWeight: '600',
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
});
