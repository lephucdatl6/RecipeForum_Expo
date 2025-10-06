import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../../config/apiConfig';
import { uploadImageAsync } from '../../utils/imageUploadUtils';

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
  ingredientId: number;
  name: string;
  amount: number;
  unit: string;
}

interface IngredientOption {
  id: number;
  name: string;
  description?: string;
}

export default function CreatePostScreen() {
  const params = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientOptions, setIngredientOptions] = useState<IngredientOption[]>([]);
  const [showIngredientSearch, setShowIngredientSearch] = useState(false);
  const [showUnitSelector, setShowUnitSelector] = useState<number | null>(null); // Track which ingredient's unit selector is shown
  
  // Common units for ingredients
  const commonUnits = ['pcs', 'cups', 'tbsp', 'tsp', 'grams', 'kg', 'lbs', 'oz', 'ml', 'liters', 'cloves', 'slices', 'bunch'];
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cookingTime: '',
    difficulty: 'Easy',
    category: '',
    author: '',
    authorEmail: ''
  });

  useEffect(() => {
    if (params.userData) {
      try {
        const user = JSON.parse(params.userData as string);
        setUserData(user);
        setFormData(prev => ({
          ...prev,
          author: user.username,
          authorEmail: user.email
        }));
      } catch (error) {
        console.error('Error parsing user data:', error);
        Alert.alert('Error', 'Failed to load user data. Please try again.');
      }
    }
  }, [params.userData]);

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
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  // Ingredient management functions
  const searchIngredients = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setIngredientOptions([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/ingredients?search=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      
      if (response.ok) {
        setIngredientOptions(data.ingredients || []);
      } else {
        console.error('Error searching ingredients:', data.error);
        setIngredientOptions([]);
      }
    } catch (error) {
      console.error('Error searching ingredients:', error);
      setIngredientOptions([]);
    }
  };

  const addIngredient = (ingredientOption: IngredientOption) => {
    // Check if ingredient already exists
    const exists = ingredients.find(ing => ing.ingredientId === ingredientOption.id);
    if (exists) {
      Alert.alert('Already Added', 'This ingredient is already in your recipe');
      return;
    }

    const newIngredient: Ingredient = {
      ingredientId: ingredientOption.id,
      name: ingredientOption.name,
      amount: 1,
      unit: 'pcs'
    };

    setIngredients([...ingredients, newIngredient]);
    setIngredientSearch('');
    setIngredientOptions([]);
    setShowIngredientSearch(false);
  };

  const updateIngredientAmount = (index: number, amount: string) => {
    const updatedIngredients = [...ingredients];
        if (amount === '' || /^\d*\.?\d*$/.test(amount)) {
      const numericAmount = parseFloat(amount);
      updatedIngredients[index].amount = isNaN(numericAmount) ? 0 : numericAmount;
      setIngredients(updatedIngredients);
    }
  };

  const updateIngredientUnit = (index: number, unit: string) => {
    const updatedIngredients = [...ingredients];
    updatedIngredients[index].unit = unit;
    setIngredients(updatedIngredients);
    setShowUnitSelector(null);
  };

  const selectUnit = (index: number, unit: string) => {
    updateIngredientUnit(index, unit);
  };

  const removeIngredient = (index: number) => {
    const updatedIngredients = ingredients.filter((_, i) => i !== index);
    setIngredients(updatedIngredients);
  };

  const handlePostData = async () => {
    try {
      setIsPosting(true);
      
      // Validate required fields
      if (!formData.title || !formData.description || !formData.cookingTime || !formData.category) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      // Validate ingredients - check for zero amounts
      const invalidIngredients = ingredients.filter(ingredient => ingredient.amount <= 0);
      if (invalidIngredients.length > 0) {
        Alert.alert('Invalid Ingredients', 'Please enter a valid amount (greater than 0) for all ingredients or remove them.');
        return;
      }

      // Ensure user data is available
      if (!userData) {
        Alert.alert('Error', 'User information not available. Please login again.');
        return;
      }

      // Create recipe immediately (optimistic creation)
      setLoadingMessage('Creating recipe...');
      const recipeData = {
        title: formData.title,
        description: formData.description,
        cookingTime: parseInt(formData.cookingTime),
        difficulty: formData.difficulty,
        category: formData.category,
        author: formData.author,
        authorEmail: formData.authorEmail,
        ingredients: ingredients,
        image: null, 
        imageStatus: selectedImage ? 'pending' : 'none' // Mark as pending if image selected
      };

      const response = await fetch(`${API_BASE_URL}/api/recipes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recipeData),
      });

      const result = await response.json();

      if (result.success) {
        const recipeId = result.recipe._id;
        
        // Show success immediately and navigate back
        Alert.alert(
          'Success!', 
          selectedImage 
            ? 'Recipe created! Image is being processed and will appear shortly.' 
            : 'Your recipe has been posted successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to forum screen
                router.replace({
                  pathname: './RecipesForumScreen',
                  params: { userData: JSON.stringify(userData) }
                });
              }
            }
          ]
        );

        // Upload image in background if selected
        if (selectedImage && recipeId) {
          // Add a small delay to ensure the forum screen shows "pending" status
          setTimeout(() => {
            uploadImageAsync(recipeId, selectedImage);
          }, 2000); // 2 second delay to show "Image processing..." status
        }
      } else {
        // Show more detailed error if it's a validation error
        const errorMessage = result.error || 'Failed to create recipe. Please try again.';
        Alert.alert('Error', errorMessage);
      }

    } catch (error) {
      console.error('Error posting recipe:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setIsPosting(false);
      setLoadingMessage('');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Create Post</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Share Your Recipe</Text>
          
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
                  <Ionicons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                <Ionicons name="camera-outline" size={32} color="#666" />
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

          {/* Ingredients Section */}
          <View style={styles.ingredientsContainer}>
            <Text style={styles.ingredientsLabel}>Ingredients</Text>
            
            {/* Add Ingredient Button */}
            <TouchableOpacity
              style={styles.addIngredientButton}
              onPress={() => {
                setShowIngredientSearch(true);
              }}
            >
              <Text style={styles.addIngredientButtonText}>+ Add Ingredient</Text>
            </TouchableOpacity>

            {/* Ingredient Search */}
            {showIngredientSearch && (
              <View style={styles.ingredientSearchContainer}>
                <TextInput
                  style={styles.ingredientSearchInput}
                  placeholder="Search for ingredients..."
                  placeholderTextColor="#666"
                  value={ingredientSearch}
                  onChangeText={(text) => {
                    setIngredientSearch(text);
                    searchIngredients(text);
                  }}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.cancelSearchButton}
                  onPress={() => {
                    setShowIngredientSearch(false);
                    setIngredientSearch('');
                    setIngredientOptions([]);
                  }}
                >
                  <Text style={styles.cancelSearchText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Search Results */}
            {ingredientOptions.length > 0 && (
              <ScrollView 
                style={styles.searchResults}
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled={true}
              >
                {ingredientOptions.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={styles.searchResultItem}
                    onPress={() => addIngredient(option)}
                  >
                    <Text style={styles.searchResultName}>{option.name}</Text>
                    {option.description && (
                      <Text style={styles.searchResultDescription}>{option.description}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Selected Ingredients List */}
            {ingredients.length > 0 && (
              <View style={styles.selectedIngredientsContainer}>
                <Text style={styles.selectedIngredientsTitle}>Selected Ingredients:</Text>
                {ingredients.map((ingredient, index) => (
                  <View key={index} style={styles.ingredientItem}>
                    <Text style={styles.ingredientName}>{ingredient.name}</Text>
                    <View style={styles.ingredientControls}>
                      <TextInput
                        style={styles.amountInput}
                        placeholder="Amount"
                        value={ingredient.amount.toString()}
                        onChangeText={(text) => updateIngredientAmount(index, text)}
                        keyboardType="decimal-pad"
                      />
                      <TouchableOpacity
                        style={styles.unitSelector}
                        onPress={() => setShowUnitSelector(showUnitSelector === index ? null : index)}
                      >
                        <Text style={styles.unitSelectorText}>{ingredient.unit || 'Unit'}</Text>
                        <Ionicons name="chevron-down" size={14} color="#666" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeIngredientButton}
                        onPress={() => removeIngredient(index)}
                      >
                        <Ionicons name="close" size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                    
                    {/* Unit Selector Dropdown */}
                    {showUnitSelector === index && (
                      <View style={styles.unitDropdown}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {commonUnits.map((unit) => (
                            <TouchableOpacity
                              key={unit}
                              style={[
                                styles.unitOption,
                                ingredient.unit === unit && styles.unitOptionSelected
                              ]}
                              onPress={() => selectUnit(index, unit)}
                            >
                              <Text style={[
                                styles.unitOptionText,
                                ingredient.unit === unit && styles.unitOptionTextSelected
                              ]}>{unit}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
          
          {userData && (
            <View style={styles.authorInfo}>
              <Text style={styles.authorLabel}>Posting as:</Text>
              <Text style={styles.authorText}>{userData.username} ({userData.email})</Text>
            </View>
          )}          
        </View>

        <TouchableOpacity 
          style={[styles.postButton, isPosting && styles.postButtonDisabled]} 
          onPress={handlePostData}
          disabled={isPosting}
        >
          <Text style={styles.postButtonText}>
            {isPosting ? `${loadingMessage || 'Posting...'}` : 'Post Recipe'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    width: 60, // Same width as back button for centering
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
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 150,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    flex: 1,
    marginHorizontal: 5,
  },
  authorInfo: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginTop: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  authorLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  authorText: {
    fontSize: 16,
    color: '#2196f3',
    fontWeight: '600',
  },
  postButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  postButtonDisabled: {
    backgroundColor: '#A5D6A7',
    opacity: 0.6,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
  ingredientsContainer: {
    marginBottom: 20,
  },
  ingredientsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  addIngredientButton: {
    backgroundColor: '#ff8c00',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  addIngredientButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  ingredientSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ingredientSearchInput: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginRight: 10,
  },
  cancelSearchButton: {
    backgroundColor: '#666',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  cancelSearchText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  searchResults: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 15,
    maxHeight: 150,
    minHeight: 100,
  },
  searchResultItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  searchResultDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  selectedIngredientsContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
  },
  selectedIngredientsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  ingredientItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 15,
    marginBottom: 15,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  ingredientControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginRight: 8,
  },
  unitSelector: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitSelectorText: {
    fontSize: 14,
    color: '#333',
  },
  unitSelectorArrow: {
    fontSize: 10,
    color: '#666',
  },
  unitDropdown: {
    marginTop: 8,
    marginBottom: 8,
  },
  unitOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  unitOptionSelected: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
  },
  unitOptionText: {
    fontSize: 14,
    color: '#333',
  },
  unitOptionTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  removeIngredientButton: {
    backgroundColor: '#ff4444',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
