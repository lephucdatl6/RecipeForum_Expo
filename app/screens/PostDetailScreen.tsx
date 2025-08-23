import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../../config/apiConfig';

interface Recipe {
  id: number;
  title: string;
  description: string;
  cookingTime: string;
  category: string;
  difficulty?: string;
  author: string;
  authorEmail: string;
  authorProfileImage?: string;
  upvotes?: number;
  downvotes?: number;
  created_at: string;
  updatedAt?: string | null;
  userVote?: 'upvote' | 'downvote' | null;
}

interface UserData {
  user_id: number;
  username: string;
  email: string;
  dateOfBirth: string;
  phone: string;
  points: number;
  created_at?: string;
}

export default function PostDetailScreen() {
  const params = useLocalSearchParams();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [lastProcessedUpdatedEmail, setLastProcessedUpdatedEmail] = useState<string>('');
  const [originalUserData, setOriginalUserData] = useState<UserData | null>(null);
  const [voteStatusLoaded, setVoteStatusLoaded] = useState(false);
  const [authorProfileImage, setAuthorProfileImage] = useState<string | null>(null);

  useEffect(() => {
    if (params.recipe) {
      try {
        const recipeData = JSON.parse(params.recipe as string);
        if (recipeData._id && !recipeData.id) {
          recipeData.id = recipeData._id;
        }
        setRecipe(recipeData);
        setAuthorProfileImage(null); // Reset profile image when recipe changes
        setVoteStatusLoaded(recipeData.hasOwnProperty('userVote'));
      } catch (error) {
        console.error('Error parsing recipe data:', error);
      }
    }

    if (params.userData) {
      try {
        const user = JSON.parse(params.userData as string);
        setUserData(user);
        setOriginalUserData(user); // Store original data from login
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, [params.recipe, params.userData]);

  // Load user vote status only once when component loads and only if missing
  useEffect(() => {
    const loadInitialVoteStatus = async () => {
      if (!userData || !recipe || voteStatusLoaded) return;

      try {
        const response = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}/vote-status/${userData.email}`);
        const data = await response.json();
        
        if (data.success) {
          setRecipe(prev => prev ? {
            ...prev,
            userVote: data.userVote,
            upvotes: data.upvotes,
            downvotes: data.downvotes
          } : null);
          setVoteStatusLoaded(true);
        }
      } catch (error) {
        console.error('Error loading vote status:', error);
      }
    };

    loadInitialVoteStatus();
  }, [userData, recipe, voteStatusLoaded]);

  // Handle updated email from EditProfileScreen
  useEffect(() => {
    if (params.updatedEmail && 
        params.updatedEmail !== userData?.email && 
        params.updatedEmail !== lastProcessedUpdatedEmail) {
      setLastProcessedUpdatedEmail(params.updatedEmail as string);
      
      if (originalUserData) {
        const updatedUser = {
          ...originalUserData,
          email: params.updatedEmail as string
        };
        setUserData(updatedUser);
      }
    }
  }, [params.updatedEmail, userData?.email, originalUserData, lastProcessedUpdatedEmail]);

  // Function to refresh user data from API
  const refreshUserData = useCallback(async () => {
    if (userData?.email && originalUserData) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/profile/${userData.email}`);
        const data = await response.json();
        
        if (data.success) {
          const updatedUser: UserData = {
            ...originalUserData,
            username: data.user.username,
            email: data.user.email,
            points: data.user.points || originalUserData.points || 0,
            dateOfBirth: data.user.dateOfBirth || originalUserData.dateOfBirth,
            phone: data.user.phone || originalUserData.phone,
          };
          setUserData(updatedUser);
        }
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }
  }, [userData?.email, originalUserData]);

  // Function to refresh recipe data from API
  const refreshRecipeData = useCallback(async () => {
    if (recipe?.id && userData?.email) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}`);
        const data = await response.json();
        
        if (data.success && data.recipe) {
          // Also get the user vote status
          const voteResponse = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}/vote-status/${userData.email}`);
          const voteData = await voteResponse.json();
          
          const updatedRecipe: Recipe = {
            id: data.recipe._id,
            title: data.recipe.title,
            description: data.recipe.description,
            cookingTime: data.recipe.cookingTime.toString(),
            category: data.recipe.category,
            difficulty: data.recipe.difficulty,
            author: data.recipe.author,
            authorEmail: data.recipe.authorEmail,
            upvotes: voteData.success ? voteData.upvotes : (data.recipe.upvotes || 0),
            downvotes: voteData.success ? voteData.downvotes : (data.recipe.downvotes || 0),
            created_at: data.recipe.createdAt,
            updatedAt: data.recipe.updatedAt,
            userVote: voteData.success ? voteData.userVote : null
          };
          setRecipe(updatedRecipe);
          setVoteStatusLoaded(true);
        }
      } catch (error) {
        console.error('Error refreshing recipe data:', error);
      }
    }
  }, [recipe?.id, userData?.email]);

  // Refresh data when screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      // Only refresh if the necessary data and vote status is already loaded
      if (userData?.email && recipe?.id && voteStatusLoaded) {
        const timeoutId = setTimeout(() => {
          refreshRecipeData();
          if (userData?.email !== lastProcessedUpdatedEmail) {
            refreshUserData();
          }
        }, 200);
        
        return () => clearTimeout(timeoutId);
      }
    }, [refreshRecipeData, refreshUserData, userData?.email, lastProcessedUpdatedEmail, recipe?.id, voteStatusLoaded])
  );

  // Load author profile image
  useEffect(() => {
    const loadAuthorProfileImage = async () => {
      if (recipe?.authorEmail && !authorProfileImage) {
        try {
          const authorResponse = await fetch(`${API_BASE_URL}/api/users/profile/${recipe.authorEmail}`);
          const authorData = await authorResponse.json();
          if (authorData.success && authorData.user?.profileImageUrl) {
            setAuthorProfileImage(authorData.user.profileImageUrl);
          }
        } catch (error) {
          console.log('Author profile image not found:', error);
        }
      }
    };

    loadAuthorProfileImage();
  }, [recipe?.authorEmail, authorProfileImage]);

  const handleBack = () => {
    router.back();
  };

  const handleViewAuthorProfile = () => {
    if (recipe?.authorEmail) {
      router.push({
        pathname: './ViewProfileScreen',
        params: { 
          email: recipe.authorEmail,
          currentUserEmail: userData?.email || ''
        }
      });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'Unknown date';
      
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'Unknown date';
      }
      
      // Format: "20 Aug 2024 | 2:00" or "20 Aug 2024 | 18:00"
      const day = date.getDate();
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      const time = date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: false // Use 24-hour format
      });
      
      return `${day} ${month} ${year} | ${time}`;
      
    } catch {
      return 'Unknown date';
    }
  };

  const getDateInfo = (recipe: Recipe) => {
    return {
      posted: {
        label: '📅 Posted:',
        value: formatDate(recipe.created_at)
      },
      edited: recipe.updatedAt ? {
        label: '✏️ Last edited:',
        value: formatDate(recipe.updatedAt)
      } : null
    };
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return '#4CAF50'; 
      case 'medium':
        return '#ff6b35'; 
      case 'hard':
        return '#F44336'; 
      default:
        return '#ff6b35'; 
    }
  };

  const handleDelete = async () => {
    if (!recipe || !userData) return;

    Alert.alert(
      'Delete Post',
      `Are you sure you want to delete "${recipe.title}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}`, {
                method: 'DELETE',
              });

              const result = await response.json();

              if (result.success) {
                Alert.alert(
                  'Your post has been deleted successfully!',
                  '',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        router.back();
                      }
                    }
                  ]
                );
              } else {
                Alert.alert('Error', result.error || 'Failed to delete post');
              }
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleEdit = () => {
    setShowMoreOptions(false); // Close the options menu
    if (recipe && userData) {
      router.push({
        pathname: './EditPostScreen',
        params: {
          recipe: JSON.stringify(recipe),
          userData: JSON.stringify(userData)
        }
      });
    }
  };

  const handleMoreOptions = () => {
    setShowMoreOptions(true);
  };

  const handleVote = async (voteType: 'upvote' | 'downvote') => {
    if (!userData || !recipe) {
      Alert.alert('Error', 'Please login to vote');
      return;
    }

    try {
      // Determine the actual vote type to send
      let actualVoteType = voteType;
      if (recipe.userVote === voteType) {
        // If clicking the same vote, remove it
        actualVoteType = 'remove' as any;
      }

      const response = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}/vote`, {
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
        // Update the recipe with new vote data
        setRecipe(prev => prev ? {
          ...prev,
          upvotes: data.upvotes,
          downvotes: data.downvotes,
          userVote: data.userVote
        } : null);
      } else {
        Alert.alert('Error', data.error || 'Failed to vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to vote. Please try again.');
    }
  };

  // Check if current user is the owner of the post
  const isOwner = userData && recipe && userData.email === recipe.authorEmail;

  if (!recipe) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Post Details</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Post not found</Text>
        </View>
      </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Post Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.recipeCard}>
          <View style={styles.recipeHeader}>
            <View style={styles.titleRow}>
              <Text style={styles.recipeTitle}>{recipe.title}</Text>
              {isOwner && (
                <TouchableOpacity style={styles.moreOptionsButton} onPress={handleMoreOptions}>
                  <Text style={styles.moreOptionsButtonText}>⋯</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{recipe.category}</Text>
            </View>
          </View>

          <View style={styles.metaInfo}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>⏱️ Cooking Time:</Text>
              <Text style={styles.metaValue}>{recipe.cookingTime} minutes</Text>
            </View>
            {recipe.difficulty && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>🍽️ Difficulty:</Text>
                <Text style={[styles.metaValue, styles.difficultyValue, { color: getDifficultyColor(recipe.difficulty) }]}>
                  {recipe.difficulty}
                </Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>👤 Author:</Text>
              <View style={styles.authorContainer}>
                <View style={styles.authorProfileImageContainer}>
                  {authorProfileImage ? (
                    <Image 
                      source={{ uri: authorProfileImage }} 
                      style={styles.authorProfileImage}
                    />
                  ) : (
                    <View style={[styles.authorProfileImage, styles.authorInitials]}>
                      <Text style={styles.authorInitialsText}>
                        {recipe.author.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={handleViewAuthorProfile}>
                  <Text style={[styles.metaValue, styles.authorName]}>{recipe.author}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{getDateInfo(recipe).posted.label}</Text>
              <Text style={styles.metaValue}>
                {getDateInfo(recipe).posted.value}
              </Text>
            </View>
            {getDateInfo(recipe).edited && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{getDateInfo(recipe).edited!.label}</Text>
                <Text style={[styles.metaValue, styles.editedText]}>
                  {getDateInfo(recipe).edited!.value}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{recipe.description}</Text>
          </View>

          {/* Voting Section */}
          {voteStatusLoaded ? (
            <View style={styles.votingSection}>
              <View style={styles.votingControls}>
                <TouchableOpacity 
                  style={[styles.voteButton, recipe.userVote === 'upvote' && styles.voteButtonActive]}
                  onPress={() => handleVote('upvote')}
                >
                  <Text style={[styles.voteIcon, recipe.userVote === 'upvote' && styles.voteIconActive]}>▲</Text>
                </TouchableOpacity>
                
                <View style={styles.netVotes}>
                  <Text style={styles.netVotesText}>
                    {(recipe.upvotes || 0) - (recipe.downvotes || 0)}
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={[styles.voteButton, recipe.userVote === 'downvote' && styles.voteButtonActive]}
                  onPress={() => handleVote('downvote')}
                >
                  <Text style={[styles.voteIcon, recipe.userVote === 'downvote' && styles.voteIconActive]}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.votingSection}>
              <View style={styles.votingControls}>
                <View style={[styles.voteButton, { opacity: 0.5 }]}>
                  <Text style={styles.voteIcon}>▲</Text>
                </View>
                
                <View style={styles.netVotes}>
                  <Text style={styles.netVotesText}>
                    {(recipe.upvotes || 0) - (recipe.downvotes || 0)}
                  </Text>
                </View>
                
                <View style={[styles.voteButton, { opacity: 0.5 }]}>
                  <Text style={styles.voteIcon}>▼</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>

    {/* More Options Modal */}
    <Modal
      transparent={true}
      visible={showMoreOptions}
      animationType="fade"
      onRequestClose={() => setShowMoreOptions(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowMoreOptions(false)}
      >
        <View style={styles.modalContent}>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={handleEdit}
          >
            <Text style={styles.optionText}>Edit post</Text>
          </TouchableOpacity>
          
          <View style={styles.optionSeparator} />
          
          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => {
              setShowMoreOptions(false);
              handleDelete();
            }}
          >
            <Text style={[styles.optionText, styles.deleteText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  recipeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recipeHeader: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  moreOptionsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginLeft: 10,
  },
  moreOptionsButtonText: {
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 120, // Position below header
    paddingRight: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 8,
    minWidth: 140,
    maxWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionSeparator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  optionText: {
    fontSize: 15,
    color: '#000',
    fontWeight: '400',
  },
  deleteText: {
    color: '#ff4444',
  },
  categoryBadge: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  categoryText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  metaInfo: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  metaLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  authorName: {
    color: '#333333',
    textDecorationLine: 'underline',
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorProfileImageContainer: {
    marginRight: 8,
  },
  authorProfileImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  authorInitials: {
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorInitialsText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  editedText: {
    color: '#ff8c00',
    fontStyle: 'italic',
  },
  difficultyValue: {
    fontWeight: 'bold',
  },
  descriptionSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
  },
  placeholderSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff8c00',
  },
  placeholderText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
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
  votingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
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
});
