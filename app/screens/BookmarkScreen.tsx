import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomNavigation from '../../components/BottomNavigation';
import { API_BASE_URL } from '../../config/apiConfig';
import { useCart } from '../../contexts/CartContext';

interface UserData {
  user_id: string;
  username: string;
  email: string;
  dateOfBirth: string;
  phone: string;
  points: number;
  created_at?: string;
}

interface Recipe {
  _id: string;
  title: string;
  description: string;
  cookingTime: number;
  difficulty?: string;
  category: string;
  author: string;
  authorEmail: string;
  upvotes?: number;
  downvotes?: number;
  createdAt: string;
  image?: string;
  imageStatus?: 'none' | 'pending' | 'processing' | 'ready' | 'failed';
  commentCount?: number;
}

export default function BookmarkScreen() {
  const params = useLocalSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [bookmarkedRecipes, setBookmarkedRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { loadCartItemCount } = useCart();

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
      console.log('BookmarkScreen - No user data available');
    }
  }, [params.userData]);

  useEffect(() => {
    if (userData?.user_id) {
      loadCartItemCount(userData.user_id);
      loadBookmarks();
    }
  }, [userData?.user_id, loadCartItemCount]);

  useFocusEffect(
    useCallback(() => {
      if (userData?.user_id) {
        loadCartItemCount(userData.user_id);
        loadBookmarks();
      }
    }, [userData?.user_id, loadCartItemCount])
  );

  const loadBookmarks = async () => {
    if (!userData?.user_id) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/bookmarks/${userData.user_id}`);
      const data = await response.json();
      
      if (data.success) {
        let recipesWithIds = data.recipes || [];
        
        // Load comment counts for all bookmarked recipes
        try {
          const commentPromises = recipesWithIds.map(async (recipe: any) => {
            try {
              const commentResponse = await fetch(`${API_BASE_URL}/api/recipes/${recipe._id}/comments/stats`);
              const commentData = await commentResponse.json();
              
              if (commentData.success) {
                return {
                  ...recipe,
                  commentCount: commentData.stats.totalComments
                };
              }
            } catch (commentError) {
              console.error('Error loading comment count for recipe:', recipe._id, commentError);
            }
            return { ...recipe, commentCount: 0 };
          });
          
          recipesWithIds = await Promise.all(commentPromises);
        } catch (error) {
          console.error('Error loading comment counts:', error);
        }
        
        setBookmarkedRecipes(recipesWithIds);
      } else {
        console.error('Failed to load bookmarks:', data.error);
        Alert.alert('Error', 'Failed to load bookmarked recipes');
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      Alert.alert('Error', 'Failed to load bookmarked recipes');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookmarks();
    setRefreshing(false);
  };

  const handleUnbookmark = async (recipeId: string, recipeTitle: string) => {
    if (!userData?.user_id) return;
    
    // Show confirmation dialog before unbookmarking
    Alert.alert(
      'Remove Bookmark',
      `Are you sure you want to remove "${recipeTitle}" from your bookmarks?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/bookmarks`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: userData.user_id,
                  recipeId: recipeId,
                }),
              });

              const data = await response.json();

              if (data.success) {
                // Remove the recipe from the local state immediately
                setBookmarkedRecipes(prev => prev.filter(recipe => recipe._id !== recipeId));
                Alert.alert('Success', 'Recipe removed from bookmarks');
              } else {
                console.error('Failed to unbookmark recipe:', data.error);
                Alert.alert('Error', 'Failed to remove bookmark');
              }
            } catch (error) {
              console.error('Error unbookmarking recipe:', error);
              Alert.alert('Error', 'Failed to remove bookmark');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleRecipePress = (recipe: Recipe) => {
    router.push({
      pathname: '/screens/PostDetailScreen',
      params: {
        userData: JSON.stringify(userData),
        recipe: JSON.stringify(recipe)
      }
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'hard': return '#F44336';
      default: return '#666';
    }
  };

  const renderBookmarkCard = ({ item }: { item: Recipe }) => (
    <View style={styles.recipeCard}>
      <TouchableOpacity onPress={() => handleRecipePress(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.recipeTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>
        
        <Text style={styles.recipeDescription} numberOfLines={2}>
          {item.description}
        </Text>
        
        {/* Recipe Image */}
        {item.imageStatus === 'ready' && item.image && (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: item.image }} 
              style={styles.recipeImage}
            />
          </View>
        )}
        
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
          <Text style={styles.postDate}>{formatDate(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
      
      <View style={{ height: 20 }} />
      
      <View style={styles.actionsContainer}>
        <View style={styles.votingSection}>
          <View style={[styles.voteButton, { opacity: 0.5 }]}>
            <Text style={styles.voteIcon}>▲</Text>
          </View>
          
          <View style={styles.netVotes}>
            <Text style={styles.netVotesText}>
              {(item.upvotes || 0) - (item.downvotes || 0)}
            </Text>
          </View>
          
          <View style={[styles.voteButton, { opacity: 0.5 }]}>
            <Text style={styles.voteIcon}>▼</Text>
          </View>
        </View>

        <View style={styles.commentSection}>
          <Text style={styles.commentCountIcon}>💬</Text>
          <Text style={styles.commentCountText}>{item.commentCount || 0}</Text>
        </View>

        <TouchableOpacity 
          style={styles.bookmarkButton}
          onPress={() => handleUnbookmark(item._id, item.title)}
        >
          <Text style={styles.bookmarkIcon}>❌</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No Bookmarks Yet</Text>
      <Text style={styles.emptyDescription}>
        Start bookmarking your favorite recipes from the forum to see them here!
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookmarks</Text>
        <Text style={styles.subtitle}>
          {bookmarkedRecipes.length} {bookmarkedRecipes.length === 1 ? 'Recipe' : 'Recipes'}
        </Text>
      </View>

      <FlatList
        data={bookmarkedRecipes}
        renderItem={renderBookmarkCard}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[
          styles.listContainer,
          bookmarkedRecipes.length === 0 && styles.emptyListContainer
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
      
      <BottomNavigation activeTab="bookmarks" userData={userData} />
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  listContainer: {
    padding: 15,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  recipeCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
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
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  recipeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 15,
  },
  imageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 15,
  },
  recipeImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  cookingTime: {
    fontSize: 12,
    color: '#666',
    marginRight: 15,
    marginBottom: 5,
  },
  difficulty: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 15,
    marginBottom: 5,
  },
  author: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  postDate: {
    fontSize: 12,
    color: '#999',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsIcon: {
    fontSize: 16,
    marginRight: 5,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
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
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  votingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 5,
    paddingHorizontal: 15,
    backgroundColor: '#fafafa',
    marginTop: 8,
    borderRadius: 20,
    width: 110,
    height: 40,                  
    alignSelf: 'flex-start',   
  },
  commentSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 5,
    paddingHorizontal: 15,
    backgroundColor: '#fafafa',
    marginTop: 8,
    borderRadius: 20,
    width: 60,
    height: 40,                  
    alignSelf: 'flex-start',   
  },
  voteButton: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,        
    borderRadius: 15,
    backgroundColor: '#f8f8f8',
    minWidth: 30,                
    justifyContent: 'center',
    marginHorizontal: 2,         
  },
  voteIcon: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
  netVotes: {
    paddingVertical: 4,
    paddingHorizontal: 8,        
    backgroundColor: '#e8f4f8',
    borderRadius: 12,
    minWidth: 30,                
    alignItems: 'center',
    marginHorizontal: 2,         
  },
  netVotesText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  commentCountIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  commentCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  bookmarkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 5,
    paddingHorizontal: 15,
    backgroundColor: '#fafafa',
    marginTop: 8,
    borderRadius: 20,
    width: 60,
    height: 40,                  
    alignSelf: 'flex-start',   
  },
  bookmarkIcon: {
    fontSize: 16,
    color: '#666',
  },
});
