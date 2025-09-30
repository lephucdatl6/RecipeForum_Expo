import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../../config/apiConfig';

interface UserProfile {
  username: string;
  email: string;
  points: number;
  memberSince: string;
  profileImageUrl?: string;
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
}

export default function ViewProfileScreen() {
  const params = useLocalSearchParams();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Check if this is the current user's profile
  const isOwnProfile = params.currentUserEmail && params.email === params.currentUserEmail;

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!params.email) {
        setError('No user email provided');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/users/profile/${params.email}`);
        const data = await response.json();

        if (data.success) {
          setUserProfile(data.user);
        } else {
          setError(data.message || 'Failed to load user profile');
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError('Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [params.email]);

  const fetchUserPosts = async () => {
    if (!params.email) return;
    
    try {
      setPostsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/recipes`);
      const data = await response.json();
      
      if (data.success) {
        // Filter recipes by author email
        const userRecipes = data.recipes.filter((recipe: Recipe) => 
          recipe.authorEmail === params.email
        );
        setUserPosts(userRecipes);
      } else {
        console.error('Failed to load user posts:', data.error);
      }
    } catch (err) {
      console.error('Error fetching user posts:', err);
    } finally {
      setPostsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Refetch both profile and posts
    if (!params.email) {
      setRefreshing(false);
      return;
    }

    try {
      // Fetch user profile
      const profileResponse = await fetch(`${API_BASE_URL}/api/users/profile/${params.email}`);
      const profileData = await profileResponse.json();
      if (profileData.success) {
        setUserProfile(profileData.user);
      }
      
      // Fetch user posts
      const postsResponse = await fetch(`${API_BASE_URL}/api/recipes`);
      const postsData = await postsResponse.json();
      if (postsData.success) {
        const userRecipes = postsData.recipes.filter((recipe: Recipe) => 
          recipe.authorEmail === params.email
        );
        setUserPosts(userRecipes);
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
    } finally {
      setRefreshing(false);
    }
  }, [params.email]);

  // Load user posts when profile is loaded
  useEffect(() => {
    if (userProfile) {
      fetchUserPosts();
    }
  }, [userProfile, params.email]);

  const handleBack = () => {
    router.back();
  };

  const handlePostPress = (recipe: Recipe) => {
    router.push({
      pathname: './PostDetailScreen',
      params: {
        recipe: JSON.stringify({
          id: recipe._id,
          title: recipe.title,
          description: recipe.description,
          cookingTime: recipe.cookingTime.toString(),
          category: recipe.category,
          difficulty: recipe.difficulty,
          author: recipe.author,
          authorEmail: recipe.authorEmail,
          upvotes: recipe.upvotes || 0,
          downvotes: recipe.downvotes || 0,
          created_at: recipe.createdAt,
          image: recipe.image,
          imageStatus: recipe.imageStatus
        }),
        userData: params.currentUserData || '{}'
      }
    });
  };

  const handleEditProfile = () => {
    if (userProfile?.email) {
      router.push({
        pathname: './EditProfileScreen',
        params: { 
          email: userProfile.email,
          source: 'ViewProfileScreen'
        }
      });
    }
  };

  const formatPostDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) return 'Today';
      if (diffInDays === 1) return 'Yesterday';
      if (diffInDays < 7) return `${diffInDays} days ago`;
      if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
      if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
      
      return `${Math.floor(diffInDays / 365)} years ago`;
    } catch {
      return 'Unknown date';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'Unknown';
      
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return 'Unknown';
      }
      
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return 'Unknown';
    }
  };

  const renderPostItem = ({ item }: { item: Recipe }) => (
    <TouchableOpacity style={styles.postCard} onPress={() => handlePostPress(item)}>
      <View style={styles.postHeader}>
        <View style={styles.postTitleRow}>
          <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>
        <Text style={styles.postDate}>{formatPostDate(item.createdAt)}</Text>
      </View>
      
      <Text style={styles.postDescription} numberOfLines={3}>{item.description}</Text>
      
      <View style={styles.postFooter}>
        <View style={styles.postMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color="#666" />
            <Text style={styles.metaText}>{item.cookingTime} min</Text>
          </View>
          {item.difficulty && (
            <View style={styles.metaItem}>
              <Ionicons name="restaurant-outline" size={14} color="#666" />
              <Text style={styles.metaText}>{item.difficulty}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.postStats}>
          <View style={styles.statItem}>
            <Ionicons name="chevron-up" size={14} color="#4CAF50" />
            <Text style={styles.statText}>{item.upvotes || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="chevron-down" size={14} color="#F44336" />
            <Text style={styles.statText}>{item.downvotes || 0}</Text>
          </View>
        </View>
      </View>
      
      {item.imageStatus === 'ready' && item.image && (
        <Image source={{ uri: item.image }} style={styles.postImage} />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <View style={styles.backButtonContent}>
                <Ionicons name="chevron-back" size={20} color="#007AFF" />
                <Text style={styles.backButtonText}>Back</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.title}>User Profile</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        </View>
      </>
    );
  }

  if (error || !userProfile) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <View style={styles.backButtonContent}>
                <Ionicons name="chevron-back" size={20} color="#007AFF" />
                <Text style={styles.backButtonText}>Back</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.title}>User Profile</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error || 'User not found'}</Text>
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
            <View style={styles.backButtonContent}>
              <Ionicons name="chevron-back" size={20} color="#007AFF" />
              <Text style={styles.backButtonText}>Back</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>User Profile</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          style={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                {userProfile.profileImageUrl ? (
                  <Image 
                    source={{ uri: userProfile.profileImageUrl }} 
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {userProfile.username.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={styles.username}>{userProfile.username}</Text>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Email:</Text>
                <Text style={styles.infoValue}>{userProfile.email}</Text>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Points:</Text>
                <Text style={styles.infoValue}>{userProfile.points}</Text>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Member Since:</Text>
                <Text style={styles.infoValue}>{formatDate(userProfile.memberSince)}</Text>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Posts:</Text>
                <Text style={styles.infoValue}>{userPosts.length}</Text>
              </View>
            </View>
          </View>

          {/* Posts Section */}
          <View style={styles.postsSection}>
            <Text style={styles.sectionTitle}>Posts by {userProfile.username}</Text>
            
            {postsLoading ? (
              <View style={styles.postsLoading}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>Loading posts...</Text>
              </View>
            ) : userPosts.length > 0 ? (
              <FlatList
                data={userPosts}
                renderItem={renderPostItem}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.noPostsContainer}>
                <Ionicons name="document-text-outline" size={48} color="#ccc" />
                <Text style={styles.noPostsText}>
                  {isOwnProfile ? "You haven't posted any recipes yet" : `${userProfile.username} hasn't posted any recipes yet`}
                </Text>
              </View>
            )}
          </View>
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
  backButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  profileCard: {
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
  profileHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    width: 130,
    height: 130,
    borderRadius:140,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 130,
    height: 130,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  profileInfo: {
    gap: 20,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  postsSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  postsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  postCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  postHeader: {
    marginBottom: 10,
  },
  postTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  postTitle: {
    fontSize: 16,
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
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  postDate: {
    fontSize: 12,
    color: '#666',
  },
  postDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  postImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginTop: 10,
  },
  noPostsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noPostsText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 22,
  },
});
