import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomNavigation from '../../components/BottomNavigation';
import { API_BASE_URL } from '../../config/apiConfig';

interface UserData {
  user_id: number;
  username: string;
  email: string;
  dateOfBirth: string;
  phone: string;
  points: number;
  created_at?: string;
}

interface Recipe {
  id?: number;
  title: string;
  description: string;
  cookingTime: string;
  difficulty?: string;
  category: string;
  author: string;
  authorEmail: string;
  created_at: string;
}

export default function RecipesForumScreen() {
  const params = useLocalSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (params.userData) {
      try {
        const user = JSON.parse(params.userData as string);
        setUserData(user);
      } catch (error) {
        console.error('Error parsing user data:', error);
        Alert.alert('Error', 'Failed to load user data. Please try again.');
      }
    }
    
    // Load recipes when component mounts
    loadRecipes();
  }, [params.userData]);

  // Reload recipes when screen comes into focus (e.g., after creating a new post)
  useFocusEffect(
    useCallback(() => {
      loadRecipes();
    }, [])
  );

  const loadRecipes = async () => {
    try {
      setIsLoading(true);
      console.log('Loading recipes from:', `${API_BASE_URL}/api/recipes`);
      const response = await fetch(`${API_BASE_URL}/api/recipes`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      if (data.success && Array.isArray(data.recipes)) {
        console.log('Loaded recipes from API:', data.recipes);
        // Log the first recipe's date to debug format
        if (data.recipes.length > 0) {
          console.log('First recipe date format:', data.recipes[0].createdAt || data.recipes[0].created_at);
        }
        
        // Map recipes and handle both createdAt and created_at field names
        const recipesWithIds = data.recipes.map((recipe: any, index: number) => ({
          ...recipe,
          id: recipe._id || recipe.id || Date.now() + index, // Handle MongoDB _id
          created_at: recipe.createdAt || recipe.created_at || new Date().toISOString()
        }));
        
        setRecipes(recipesWithIds);
        console.log('Successfully loaded', recipesWithIds.length, 'recipes from database');
        return;
      } else {
        console.log('No recipes found or invalid response structure:', data);
        setRecipes([]);
        return;
      }
    } catch (error) {
      console.error('Error loading recipes from API:', error);
      console.log('API connection failed - showing empty state instead of mock data');
      // Show empty state instead of mock data when API fails
      setRecipes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePost = () => {
    if (!userData) {
      Alert.alert('Error', 'Please login to create a post');
      return;
    }
    
    router.push({
      pathname: './CreatePostScreen',
      params: { userData: JSON.stringify(userData) }
    });
  };

  const handlePostPress = (recipe: Recipe) => {
    router.push({
      pathname: './PostDetailScreen',
      params: { 
        recipe: JSON.stringify(recipe),
        userData: JSON.stringify(userData)
      }
    });
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'Unknown date';
      
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'Unknown date';
      }
      
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const diffInWeeks = Math.floor(diffInDays / 7);
      const diffInMonths = Math.floor(diffInDays / 30);
      const diffInYears = Math.floor(diffInDays / 365);
      
      // Handle future dates
      if (diffInMs < 0) return 'Just now';
      
      // Less than 1 minute
      if (diffInMinutes < 1) return 'Just now';
      
      // Less than 1 hour
      if (diffInMinutes < 60) {
        return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`;
      }
      
      // Less than 24 hours
      if (diffInHours < 24) {
        return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
      }
      
      // Less than 7 days
      if (diffInDays < 7) {
        return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
      }
      
      // Less than 4 weeks
      if (diffInWeeks < 4) {
        return diffInWeeks === 1 ? '1 week ago' : `${diffInWeeks} weeks ago`;
      }
      
      // Less than 12 months
      if (diffInMonths < 12) {
        return diffInMonths === 1 ? '1 month ago' : `${diffInMonths} months ago`;
      }
      
      // 1 year or more
      return diffInYears === 1 ? '1 year ago' : `${diffInYears} years ago`;
      
    } catch {
      return 'Unknown date';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return '#4CAF50'; 
      case 'medium':
        return '#ff6b35'; 
      case 'hard':
        return '#db1002ff'; 
      default:
        return '#ff6b35'; 
    }
  };

  const renderRecipeCard = ({ item }: { item: Recipe }) => (
    <TouchableOpacity style={styles.recipeCard} onPress={() => handlePostPress(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.recipeTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
      </View>
      
      <Text style={styles.recipeDescription} numberOfLines={2}>
        {item.description}
      </Text>
      
      <View style={styles.cardFooter}>
        <View style={styles.metaInfo}>
          <Text style={styles.cookingTime}>⏱️ {item.cookingTime} min</Text>
          {item.difficulty && (
            <Text style={[styles.difficulty, { color: getDifficultyColor(item.difficulty) }]}>
              🎯 {item.difficulty}
            </Text>
          )}
          <Text style={styles.author}>👤 {item.author}</Text>
        </View>
        <Text style={styles.postDate}>{formatDate(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>📝</Text>
      <Text style={styles.emptyStateTitle}>No recipes yet</Text>
      <Text style={styles.emptyStateSubtitle}>Be the first to share your amazing recipe!</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recipes Forum</Text>
      </View>

      <FlatList
        data={recipes}
        renderItem={renderRecipeCard}
        keyExtractor={(item, index) => item.id ? item.id.toString() : `recipe-${index}`}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadRecipes} />
        }
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
      />

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleCreatePost}>
        <Text style={styles.fabText}>➕</Text>
      </TouchableOpacity>

      <BottomNavigation activeTab="forum" userData={userData} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  listContainer: {
    paddingBottom: 100, // Space for FAB
  },
  recipeCard: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#ff8c00',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  categoryBadge: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  recipeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cookingTime: {
    fontSize: 12,
    color: '#666',
    marginRight: 15,
  },
  difficulty: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 15,
  },
  author: {
    fontSize: 12,
    color: '#666',
  },
  postDate: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyStateText: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff8c00',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  fabText: {
    fontSize: 24,
    color: 'white',
  },
});
