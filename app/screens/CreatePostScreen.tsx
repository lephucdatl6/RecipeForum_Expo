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

export default function CreatePostScreen() {
  const params = useLocalSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isPosting, setIsPosting] = useState(false);
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
        // Auto-populate author and email from logged-in user
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

  const handlePostData = async () => {
    try {
      setIsPosting(true);
      
      // Validate required fields
      if (!formData.title || !formData.description || !formData.cookingTime || !formData.category) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      // Ensure user data is available
      if (!userData) {
        Alert.alert('Error', 'User information not available. Please login again.');
        return;
      }

      // Prepare the recipe data
      const recipeData = {
        title: formData.title,
        description: formData.description,
        cookingTime: parseInt(formData.cookingTime),
        difficulty: formData.difficulty,
        category: formData.category,
        author: formData.author,
        authorEmail: formData.authorEmail,
        ingredients: [], 
        instructions: [] 
      };

      console.log('Posting recipe to:', `${API_BASE_URL}/api/recipes`);
      console.log('Recipe data:', recipeData);

      const response = await fetch(`${API_BASE_URL}/api/recipes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recipeData),
      });

      const result = await response.json();
      console.log('Server response:', result);

      if (result.success) {
        Alert.alert(
          'Success! 🎉', 
          'Your recipe has been posted successfully!',
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
      } else {
        // Show more detailed error if it a validation error
        if (result.details && result.details.includes('difficulty')) {
          Alert.alert(
            'Difficulty Error', 
            `The difficulty value "${formData.difficulty}" is not accepted by the server. ${result.details}`
          );
        } else {
          Alert.alert('Error', result.error || 'Failed to post recipe');
        }
      }

    } catch (error) {
      console.error('Error posting recipe:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setIsPosting(false);
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
        <Text style={styles.title}>Create Post</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>📝 Share Your Recipe</Text>
          
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
            {isPosting ? '🔄 Posting...' : '📤 Post Recipe'}
          </Text>
        </TouchableOpacity>
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
});
