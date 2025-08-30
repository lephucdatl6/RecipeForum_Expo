import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../../config/apiConfig';
import { uploadImageAsync } from '../../utils/imageUploadUtils';

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
  id: number;
  title: string;
  description: string;
  cookingTime: string;
  category: string;
  difficulty?: string;
  author: string;
  authorEmail: string;
  upvotes?: number;
  downvotes?: number;
  created_at: string;
  updatedAt?: string | null;
  image?: string;
  imageStatus?: string;
}

export default function EditPostScreen() {
  const params = useLocalSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cookingTime: '',
    difficulty: 'Easy',
    category: '',
    author: '',
    authorEmail: ''
  });
  const [recipeId, setRecipeId] = useState<number | null>(null);

  useEffect(() => {
    // Parse user data
    if (params.userData) {
      try {
        const user = JSON.parse(params.userData as string);
        setUserData(user);
      } catch (error) {
        console.error('Error parsing user data:', error);
        Alert.alert('Error', 'Failed to load user data. Please try again.');
      }
    }

    // Parse recipe data and populate form
    if (params.recipe) {
      try {
        const recipe: Recipe = JSON.parse(params.recipe as string);
        setRecipeId(recipe.id);
        setFormData({
          title: recipe.title,
          description: recipe.description,
          cookingTime: recipe.cookingTime.toString(),
          difficulty: recipe.difficulty || 'Easy',
          category: recipe.category,
          author: recipe.author,
          authorEmail: recipe.authorEmail
        });
        // Set the original image and current selected image
        setOriginalImage(recipe.image || null);
        setSelectedImage(recipe.image || null);
      } catch (error) {
        console.error('Error parsing recipe data:', error);
        Alert.alert('Error', 'Failed to load recipe data. Please try again.');
      }
    }
  }, [params.userData, params.recipe]);

  const handleBack = () => {
    router.back();
  };

  const pickImage = async () => {
    // Request permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const handleUpdatePost = async () => {
    try {
      setIsUpdating(true);
      
      // Validate required fields
      if (!formData.title || !formData.description || !formData.cookingTime || !formData.category) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      if (!recipeId) {
        Alert.alert('Error', 'Recipe ID not found. Cannot update.');
        return;
      }

      // Update recipe immediately (optimistic update)
      setLoadingMessage('Updating recipe...');
      
      // Determine image status for immediate update
      let imageStatus = 'none';
      let imageUrl = originalImage;
      
      if (selectedImage && selectedImage !== originalImage) {
        // New image selected - set as pending, will upload async
        imageStatus = 'pending';
        imageUrl = originalImage; // Keep original for now
      } else if (!selectedImage) {
        // Image removed
        imageStatus = 'none';
        imageUrl = null;
      } else {
        // No change to image
        imageStatus = originalImage ? 'ready' : 'none';
        imageUrl = originalImage;
      }

      // Prepare the updated recipe data
      const recipeData = {
        title: formData.title,
        description: formData.description,
        cookingTime: parseInt(formData.cookingTime),
        difficulty: formData.difficulty,
        category: formData.category,
        image: imageUrl,
        imageStatus: imageStatus
      };

      const response = await fetch(`${API_BASE_URL}/api/recipes/${recipeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recipeData),
      });

      const result = await response.json();

      if (result.success) {
        // Show success immediately and navigate back
        Alert.alert(
          'Success!', 
          (selectedImage && selectedImage !== originalImage) 
            ? 'Recipe updated! New image is being processed and will appear shortly.' 
            : 'Your recipe has been updated successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                router.back();
              }
            }
          ]
        );

        // Upload new image in background if changed
        if (selectedImage && selectedImage !== originalImage) {
          // Add a small delay to ensure the forum screen shows "pending" status
          setTimeout(() => {
            uploadImageAsync(recipeId.toString(), selectedImage);
          }, 2000); // 2 second delay to show "Image processing..." status
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to update recipe');
      }

    } catch (error) {
      console.error('Error updating recipe:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setIsUpdating(false);
      setLoadingMessage('');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Post</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Edit Your Recipe</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Recipe Title *"
            placeholderTextColor="#666"
            value={formData.title}
            onChangeText={(text) => setFormData({...formData, title: text})}
          />

          {/* Image Picker */}
          <View style={styles.imageSection}>
            <Text style={styles.imageLabel}>Recipe Image (Optional)</Text>
            {selectedImage ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                  <Text style={styles.removeImageText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                <Text style={styles.imagePickerIcon}>📷</Text>
                <Text style={styles.imagePickerText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Recipe Description *"
            placeholderTextColor="#666"
            value={formData.description}
            onChangeText={(text) => setFormData({...formData, description: text})}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Cooking Time (minutes) *"
              placeholderTextColor="#666"
              value={formData.cookingTime}
              onChangeText={(text) => setFormData({...formData, cookingTime: text})}
              keyboardType="numeric"
            />
            
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Category *"
              placeholderTextColor="#666"
              value={formData.category}
              onChangeText={(text) => setFormData({...formData, category: text})}
            />
          </View>

          {/* Difficulty Selector */}
          <View style={styles.difficultyContainer}>
            <Text style={styles.difficultyLabel}>Difficulty Level *</Text>
            <View style={styles.difficultyRow}>
              <TouchableOpacity
                style={[
                  styles.difficultyButton,
                  formData.difficulty === 'Easy' && styles.difficultyButtonSelected
                ]}
                onPress={() => setFormData({...formData, difficulty: 'Easy'})}
              >
                <Text style={[
                  styles.difficultyButtonText,
                  formData.difficulty === 'Easy' && styles.difficultyButtonTextSelected
                ]}>Easy</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.difficultyButton,
                  formData.difficulty === 'Medium' && styles.difficultyButtonSelected
                ]}
                onPress={() => setFormData({...formData, difficulty: 'Medium'})}
              >
                <Text style={[
                  styles.difficultyButtonText,
                  formData.difficulty === 'Medium' && styles.difficultyButtonTextSelected
                ]}>Medium</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.difficultyButton,
                  formData.difficulty === 'Hard' && styles.difficultyButtonSelected
                ]}
                onPress={() => setFormData({...formData, difficulty: 'Hard'})}
              >
                <Text style={[
                  styles.difficultyButtonText,
                  formData.difficulty === 'Hard' && styles.difficultyButtonTextSelected
                ]}>Hard</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.postButton, isUpdating && styles.postButtonDisabled]} 
            onPress={handleUpdatePost}
            disabled={isUpdating}
          >
            <Text style={styles.postButtonText}>
              {isUpdating ? `🔄 ${loadingMessage || 'Updating...'}` : 'Update Recipe'}
            </Text>
          </TouchableOpacity>
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
  formCard: {
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
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#fff',
    color: '#333',
  },
  textArea: {
    minHeight: 120,
    maxHeight: 200,
  },
  difficultyContainer: {
    marginBottom: 15,
  },
  difficultyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  difficultyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  difficultyButtonSelected: {
    borderColor: '#ff8c00',
    backgroundColor: '#fff3e0',
  },
  difficultyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  difficultyButtonTextSelected: {
    color: '#ff8c00',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 20,
  },
  postButton: {
    backgroundColor: '#ff8c00',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  postButtonDisabled: {
    backgroundColor: '#ccc',
  },
  postButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  imageSection: {
    marginBottom: 20,
  },
  imageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  imagePicker: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  imagePickerIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  imagePickerText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
