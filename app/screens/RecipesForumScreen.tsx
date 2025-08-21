import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Keyboard, Modal, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
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
  upvotes?: number;
  downvotes?: number;
  created_at: string;
  userVote?: 'upvote' | 'downvote' | null;
}

export default function RecipesForumScreen() {
  const params = useLocalSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most_upvoted' | 'most_downvoted'>('newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const sortOptions = [
    { key: 'newest', label: 'Newest' },
    { key: 'oldest', label: 'Oldest' },
    { key: 'most_upvoted', label: 'Most Upvoted' },
    { key: 'most_downvoted', label: 'Most Downvoted' },
  ];

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

  // Filter recipes based on search query
  const filterRecipes = useCallback((query: string, recipeList: Recipe[]) => {
    if (!query.trim()) {
      return recipeList;
    }
    
    const lowercaseQuery = query.toLowerCase();
    return recipeList.filter(recipe => 
      recipe.title.toLowerCase().includes(lowercaseQuery) ||
      recipe.description.toLowerCase().includes(lowercaseQuery) ||
      recipe.author.toLowerCase().includes(lowercaseQuery)
    );
  }, []);

  // Sort recipes based on selected option
  const sortRecipes = useCallback((recipeList: Recipe[], sortOption: string) => {
    const sorted = [...recipeList];
    
    switch (sortOption) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'most_upvoted':
        return sorted.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
      case 'most_downvoted':
        return sorted.sort((a, b) => (b.downvotes || 0) - (a.downvotes || 0));
      default:
        return sorted;
    }
  }, []);

  // Update filtered recipes when search query, recipes, or sort option changes
  useEffect(() => {
    const filtered = filterRecipes(searchQuery, recipes);
    const sorted = sortRecipes(filtered, sortBy);
    setFilteredRecipes(sorted);
  }, [searchQuery, recipes, sortBy, filterRecipes, sortRecipes]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    searchInputRef.current?.blur();
  };

  // Reload recipes when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRecipes();
    }, [userData?.email])
  );

  const loadRecipes = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/recipes`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.recipes)) {
        let recipesWithIds = data.recipes.map((recipe: any, index: number) => ({
          ...recipe,
          id: recipe._id || recipe.id || Date.now() + index,
          created_at: recipe.createdAt || recipe.created_at || new Date().toISOString()
        }));
        
        // If user is logged in, also load their vote status
        if (userData) {
          try {
            const votePromises = recipesWithIds.map(async (recipe: any) => {
              try {
                const voteResponse = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}/vote-status/${userData.email}`);
                const voteData = await voteResponse.json();
                
                if (voteData.success) {
                  return {
                    ...recipe,
                    userVote: voteData.userVote,
                    upvotes: voteData.upvotes,
                    downvotes: voteData.downvotes
                  };
                }
              } catch (voteError) {
                console.error('Error loading vote status for recipe:', recipe.id, voteError);
              }
              return recipe;
            });
            
            recipesWithIds = await Promise.all(votePromises);
          } catch (error) {
            console.error('Error loading vote statuses:', error);
          }
        }
        
        setRecipes(recipesWithIds);
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

  const handleVote = async (recipeId: string, voteType: 'upvote' | 'downvote') => {
    if (!userData) {
      Alert.alert('Error', 'Please login to vote');
      return;
    }

    try {
      // Find the current recipe to check existing vote
      const currentRecipe = recipes.find(r => r.id?.toString() === recipeId);
      if (!currentRecipe) return;

      // Determine the actual vote type to send
      let actualVoteType = voteType;
      if (currentRecipe.userVote === voteType) {
        // If clicking the same vote, remove it
        actualVoteType = 'remove' as any;
      }

      const response = await fetch(`${API_BASE_URL}/api/recipes/${recipeId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voteType: actualVoteType,
          userEmail: userData.email
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update the recipe in both recipes and filteredRecipes
        const updateRecipe = (recipe: Recipe) => {
          if (recipe.id?.toString() === recipeId) {
            return {
              ...recipe,
              upvotes: data.upvotes,
              downvotes: data.downvotes,
              userVote: data.userVote
            };
          }
          return recipe;
        };

        setRecipes(prev => prev.map(updateRecipe));
        setFilteredRecipes(prev => prev.map(updateRecipe));
      } else {
        Alert.alert('Error', data.error || 'Failed to vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to vote. Please try again.');
    }
  };

  const loadUserVotes = async () => {
    if (!userData) return;

    try {
      // Get current recipes from state
      const currentRecipes = recipes.length > 0 ? recipes : filteredRecipes;
      if (currentRecipes.length === 0) return;

      // Load vote status for all recipes
      const votePromises = currentRecipes.map(async (recipe) => {
        if (!recipe.id) return recipe;
        
        try {
          const response = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}/vote-status/${userData.email}`);
          const data = await response.json();
          
          if (data.success) {
            return {
              ...recipe,
              userVote: data.userVote,
              upvotes: data.upvotes,
              downvotes: data.downvotes
            };
          }
        } catch (error) {
          console.error('Error loading vote status:', error);
        }
        return recipe;
      });

      const recipesWithVotes = await Promise.all(votePromises);
      setRecipes(recipesWithVotes);
    } catch (error) {
      console.error('Error loading user votes:', error);
    }
  };

  // Load user votes when recipes or userData changes
  useEffect(() => {
    if (userData && recipes.length > 0) {
      loadUserVotes();
    }
  }, [userData?.email, recipes.length]);

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
    <View style={styles.recipeCard}>
      <TouchableOpacity onPress={() => handlePostPress(item)}>
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
      
      {/* Spacing between card content and voting section */}
      <View style={{ height: 20 }} />
      
      {/* Voting Section */}
      <View style={styles.votingSection}>
        <TouchableOpacity 
          style={[styles.voteButton, item.userVote === 'upvote' && styles.voteButtonActive]}
          onPress={(e) => {
            e.stopPropagation();
            handleVote(item.id?.toString() || '', 'upvote');
          }}
        >
          <Text style={[styles.voteIcon, item.userVote === 'upvote' && styles.voteIconActive]}>▲</Text>
        </TouchableOpacity>
        
        <View style={styles.netVotes}>
          <Text style={styles.netVotesText}>
            {(item.upvotes || 0) - (item.downvotes || 0)}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.voteButton, item.userVote === 'downvote' && styles.voteButtonActive]}
          onPress={(e) => {
            e.stopPropagation();
            handleVote(item.id?.toString() || '', 'downvote');
          }}
        >
          <Text style={[styles.voteIcon, item.userVote === 'downvote' && styles.voteIconActive]}>▼</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => {
    if (searchQuery.length > 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No results found</Text>
          <Text style={styles.emptyStateSubtitle}>Try searching with different keywords</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>📝</Text>
        <Text style={styles.emptyStateTitle}>No recipes yet</Text>
        <Text style={styles.emptyStateSubtitle}>Be the first to share your amazing recipe!</Text>
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={styles.container}>
        {/* Search Bar moved to header position */}
        <View style={styles.searchContainer}>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search recipes, authors, or descriptions..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

      {/* Sort Dropdown */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by</Text>
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => setShowSortDropdown(!showSortDropdown)}
        >
          <Text style={styles.sortButtonText}>
            {sortOptions.find(option => option.key === sortBy)?.label}
          </Text>
          <Text style={styles.sortArrow}>{showSortDropdown ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showSortDropdown && (
          <Modal
            transparent={true}
            visible={showSortDropdown}
            animationType="fade"
            onRequestClose={() => setShowSortDropdown(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowSortDropdown(false)}
            >
              <View style={styles.sortDropdown}>
                {sortOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.sortOption,
                      sortBy === option.key && styles.sortOptionActive
                    ]}
                    onPress={() => {
                      setSortBy(option.key as any);
                      setShowSortDropdown(false);
                    }}
                  >
                    <Text style={[
                      styles.sortOptionText,
                      sortBy === option.key && styles.sortOptionTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </View>

      {/* Results count */}
      {searchQuery.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsText}>
            {filteredRecipes.length} result{filteredRecipes.length !== 1 ? 's' : ''} found
          </Text>
        </View>
      )}

      <FlatList
        data={filteredRecipes}
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
    </TouchableWithoutFeedback>
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
  searchContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  clearButton: {
    position: 'absolute',
    right: 30,
    top: '50%',
    marginTop: 45,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  resultsContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
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
  votingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 5,
    paddingHorizontal: 15,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    marginTop: 8,
    borderRadius: 20,
    width: 110,
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
  voteButtonActive: {
    backgroundColor: '#ff8c00',
  },
  voteIcon: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
  voteIconActive: {
    color: 'white',
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
  sortContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    position: 'relative',
  },
  sortLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sortButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  sortArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  sortDropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    marginHorizontal: 20,
    maxWidth: 300,
  },
  sortOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sortOptionActive: {
    backgroundColor: '#f0f8ff',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#333',
  },
  sortOptionTextActive: {
    color: '#ff8c00',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 200, // Position below header and search
  },
});
