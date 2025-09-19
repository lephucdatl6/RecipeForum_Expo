import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  profileImageUrl?: string;
}

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [originalUserData, setOriginalUserData] = useState<UserData | null>(null);
  const [lastProcessedUpdatedEmail, setLastProcessedUpdatedEmail] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cartItemCount, setCartItemCount] = useState<number>(0);

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

  // Function to load cart item count
  const loadCartItemCount = useCallback(async () => {
    if (!userData?.email) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/cart/${userData.email}`);
      const data = await response.json();
      
      if (data.success && data.cart && data.cart.items) {
        const itemCount = data.cart.items.length;
        setCartItemCount(itemCount);
      } else {
        setCartItemCount(0);
      }
    } catch (error) {
      console.error('Error loading cart count:', error);
      setCartItemCount(0);
    }
  }, [userData?.email]);

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
    if (userData?.email) {
      loadCartItemCount();
    }
  }, [userData?.email, loadCartItemCount]);

  useFocusEffect(
    useCallback(() => {
      if (userEmail && originalUserData) {
        fetchUserDataWithEmail(userEmail, true); 
      }
      if (userData?.email) {
        loadCartItemCount();
      }
    }, [userEmail, originalUserData, fetchUserDataWithEmail, userData?.email, loadCartItemCount])
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
        <BottomNavigation activeTab="profile" userData={userData} cartItemCount={cartItemCount} />
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
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
            
            {userData.created_at && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Member since:</Text>
                <Text style={styles.infoValue}>{formatDate(userData.created_at)}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      <BottomNavigation activeTab="profile" userData={userData} cartItemCount={cartItemCount} />
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
});
