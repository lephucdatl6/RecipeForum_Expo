import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userPosts, setUserPosts] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [originalUserData, setOriginalUserData] = useState<UserData | null>(null);
  const [lastProcessedUpdatedEmail, setLastProcessedUpdatedEmail] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const { loadCartItemCount } = useCart();

  // Initialize user data from params on first load
  useEffect(() => {
    const initializeUserData = () => {
      if (params.userData) {
        try {
          const user = JSON.parse(params.userData as string);
          setUserEmail(user.email);
          setOriginalUserData(user); // Store original data from login
          setUserData(user);
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

  // Helper function to fetch user data with a specific email
  const fetchUserDataWithEmail = useCallback(async (emailToFetch: string, skipErrorLog = false) => {
    if (!emailToFetch || !originalUserData) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/profile/${emailToFetch}`);
      const data = await response.json();

      if (data.success) {
        const apiUser = data.user;
        const mergedUser: UserData = {
          ...originalUserData, 
          username: apiUser.username || originalUserData.username, 
          email: apiUser.email || originalUserData.email, 
          points: apiUser.points !== undefined ? apiUser.points : (originalUserData.points || 0),
          dateOfBirth: apiUser.dateOfBirth || originalUserData.dateOfBirth || '',
          phone: apiUser.phone || originalUserData.phone || '',
          profileImageUrl: apiUser.profileImageUrl || originalUserData.profileImageUrl,
        };
        
        setUserData(mergedUser);
        
        // Update userEmail if it has changed
        if (apiUser.email && apiUser.email !== userEmail) {
          setUserEmail(apiUser.email);
        }
      } else {
        if (!skipErrorLog && emailToFetch !== originalUserData.email) {
          fetchUserDataWithEmail(originalUserData.email, true);
        }
      }
    } catch (error) {
      if (!skipErrorLog) {
        console.error('Error fetching user data:', error);
        if (emailToFetch !== originalUserData.email) {
          fetchUserDataWithEmail(originalUserData.email, true);
        }
      }
    }
  }, [originalUserData, userEmail]);

  // Handle updated email from EditProfileScreen
  useEffect(() => {
    if (params.updatedEmail && 
        params.updatedEmail !== userEmail && 
        params.updatedEmail !== lastProcessedUpdatedEmail) {
    //   console.log(`Email updated: ${userEmail} → ${params.updatedEmail}`);
      setLastProcessedUpdatedEmail(params.updatedEmail as string);
      setUserEmail(params.updatedEmail as string);
      if (originalUserData) {
        fetchUserDataWithEmail(params.updatedEmail as string);
      }
    }
  }, [params.updatedEmail, userEmail, originalUserData, fetchUserDataWithEmail, lastProcessedUpdatedEmail]);

  const fetchUserData = useCallback(async () => {
    if (!userEmail || !originalUserData) return;
    await fetchUserDataWithEmail(userEmail);
  }, [userEmail, originalUserData, fetchUserDataWithEmail]);

  useEffect(() => {
    if (userEmail && originalUserData) {
      fetchUserData();
    }
  }, [userEmail, originalUserData, fetchUserData]);

  // Load cart count when user data is available
  useEffect(() => {
    if (userData?.user_id) {
      loadCartItemCount(userData.user_id);
    }
  }, [userData?.user_id, loadCartItemCount]);

  useFocusEffect(
    useCallback(() => {
      if (userEmail && originalUserData) {
        fetchUserDataWithEmail(userEmail, true); 
      }
      if (userData?.user_id) {
        loadCartItemCount(userData.user_id);
      }
    }, [userEmail, originalUserData, fetchUserDataWithEmail, userData?.user_id, loadCartItemCount])
  );

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => router.replace('./LoginScreen')
        }
      ]
    );
  };

  const handleEditProfile = () => {
    if (userData?.email) {
      router.push({
        pathname: './EditProfileScreen',
        params: { 
          email: userData.email,
          source: 'UserProfileScreen'
        }
      });
    }
  };

  const pickImage = async () => {
    // Request permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadImage(result.assets[0]);
    }
  };

  const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!userData?.email) return;

    setUploadingImage(true);
    
    try {
      const formData = new FormData();
      formData.append('profileImage', {
        uri: asset.uri,
        name: 'profile-image.jpg',
        type: 'image/jpeg',
      } as any);

      const response = await fetch(`${API_BASE_URL}/api/users/profile/${userData.email}/upload-image`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();

      if (data.success) {
        // Update the profile with new image URL
        setUserData(prev => prev ? {
          ...prev,
          profileImageUrl: data.imageUrl
        } : null);
        Alert.alert('Success', 'Profile image updated successfully!');
      } else {
        Alert.alert('Error', data.message || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const fetchUserPosts = async () => {
    if (!userData?.email) return;
    
    try {
      setPostsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/recipes`);
      const data = await response.json();
      
      if (data.success) {
        // Filter recipes by current user's email
        const userRecipes = data.recipes.filter((recipe: Recipe) => 
          recipe.authorEmail === userData.email
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
    if (userData?.email) {
      await Promise.all([
        fetchUserDataWithEmail(userData.email),
        fetchUserPosts()
      ]);
    }
    setRefreshing(false);
  }, [userData?.email, fetchUserDataWithEmail]);

  // Load user posts when userData is available
  useEffect(() => {
    if (userData?.email) {
      fetchUserPosts();
    }
  }, [userData?.email]);

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
        userData: JSON.stringify(userData)
      }
    });
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

  const formatDate = (dateString: string) => {
    try {
      if (!dateString || dateString.trim() === '') {
        return 'Not provided';
      }
      
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'Not provided';
      }
      
      // Format as DD-MM-YYYY
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return 'Not provided';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
        <BottomNavigation activeTab="profile" userData={userData} />
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No user data available</Text>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => router.replace('./LoginScreen')}
        >
          <Text style={styles.buttonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.userCard}>
          <Text style={styles.welcomeText}>Welcome back!</Text>
          
          {/* Profile Image Section */}
          <View style={styles.profileImageSection}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={pickImage}
              disabled={uploadingImage}
            >
              {userData.profileImageUrl ? (
                <Image 
                  source={{ uri: userData.profileImageUrl }} 
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {userData.username.charAt(0).toUpperCase()}
                </Text>
              )}
              {uploadingImage && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.profileName}>{userData.username}</Text>
            <Text style={styles.uploadHint}>Tap to change profile picture</Text>
          </View>
          
          <View style={styles.userInfo}>
            <Text style={styles.userInfoTitle}>User Information</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username:</Text>
              <Text style={styles.infoValue}>{userData.username}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{userData.email}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date of Birth:</Text>
              <Text style={styles.infoValue}>{formatDate(userData.dateOfBirth)}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{userData.phone}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Points:</Text>
              <Text style={[styles.infoValue, styles.pointsValue]}>{userData.points}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Posts:</Text>
              <Text style={styles.infoValue}>{userPosts.length}</Text>
            </View>
            
            {userData.created_at && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Member since:</Text>
                <Text style={styles.infoValue}>{formatDate(userData.created_at)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* My Posts Section */}
        <View style={styles.postsSection}>
          <Text style={styles.sectionTitle}>My Posts</Text>
          
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
                You haven't posted any recipes yet.
                Start sharing your favorite recipes!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNavigation activeTab="profile" userData={userData} />
    </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userCard: {
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
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  profileImageSection: {
    alignItems: 'center',
    marginBottom: 20,
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
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  uploadHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  userInfo: {
    marginTop: 10,
  },
  userInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  pointsValue: {
    color: '#28a745',
    fontSize: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  button: {
    backgroundColor: '#ff8c00',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
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
  },
  noPostsText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 22,
  },
});
