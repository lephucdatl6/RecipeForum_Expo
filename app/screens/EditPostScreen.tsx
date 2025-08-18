import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
}

export default function EditPostScreen() {
  const params = useLocalSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
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
      } catch (error) {
        console.error('Error parsing recipe data:', error);
        Alert.alert('Error', 'Failed to load recipe data. Please try again.');
      }
    }
  }, [params.userData, params.recipe]);

  const handleBack = () => {
    router.back();
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

      // Prepare the updated recipe data
      const recipeData = {
        title: formData.title,
        description: formData.description,
        cookingTime: parseInt(formData.cookingTime),
        difficulty: formData.difficulty,
        category: formData.category,
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
        Alert.alert(
          'Success! 🎉', 
          'Your recipe has been updated successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Small delay for database update
                setTimeout(() => {
                  router.back();
                }, 100);
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to update recipe');
      }

    } catch (error) {
      console.error('Error updating recipe:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setIsUpdating(false);
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
          <Text style={styles.formTitle}>✏️ Edit Your Recipe</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Recipe Title *"
            placeholderTextColor="#666"
            value={formData.title}
            onChangeText={(text) => setFormData({...formData, title: text})}
          />

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

          <TextInput
            style={styles.input}
            placeholder="Cooking Time (minutes) *"
            placeholderTextColor="#666"
            value={formData.cookingTime}
            onChangeText={(text) => setFormData({...formData, cookingTime: text})}
            keyboardType="numeric"
          />

          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Difficulty Level:</Text>
            <View style={styles.difficultyButtons}>
              {['Easy', 'Medium', 'Hard'].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.difficultyButton,
                    formData.difficulty === level && styles.selectedDifficulty
                  ]}
                  onPress={() => setFormData({...formData, difficulty: level})}
                >
                  <Text style={[
                    styles.difficultyText,
                    formData.difficulty === level && styles.selectedDifficultyText
                  ]}>
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Category (e.g., Breakfast, Dinner, Dessert) *"
            placeholderTextColor="#666"
            value={formData.category}
            onChangeText={(text) => setFormData({...formData, category: text})}
          />

          <View style={styles.infoSection}>
            <Text style={styles.infoText}>• Make sure your recipe is clear and easy to follow</Text>
            <Text style={styles.infoText}>• Include accurate cooking times</Text>
            <Text style={styles.infoText}>• Choose the appropriate difficulty level</Text>
          </View>

          <TouchableOpacity 
            style={[styles.postButton, isUpdating && styles.postButtonDisabled]} 
            onPress={handleUpdatePost}
            disabled={isUpdating}
          >
            <Text style={styles.postButtonText}>
              {isUpdating ? 'Updating...' : 'Update Recipe'}
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
  pickerContainer: {
    marginBottom: 15,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  difficultyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  difficultyButton: {
    flex: 1,
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  selectedDifficulty: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
  },
  difficultyText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedDifficultyText: {
    color: 'white',
    fontWeight: '600',
  },
  infoSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff8c00',
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
});
