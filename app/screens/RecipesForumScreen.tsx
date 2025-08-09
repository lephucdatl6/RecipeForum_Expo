import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

export default function RecipesForumScreen() {
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
    } else {
      console.log('RecipesForum - No user data available');
    }
  }, [params.userData]);

  const handlePostData = async () => {
    try {
      setIsPosting(true);
      
      // Validate required fields (author and email are auto-populated from logged-in user)
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
                // Reset form
                setFormData({
                  title: '',
                  description: '',
                  cookingTime: '',
                  difficulty: 'Easy',
                  category: '',
                  author: '',
                  authorEmail: ''
                });
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to post recipe');
      }

    } catch (error) {
      console.error('Error posting recipe:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Recipes Forum</Text>
        </View>

        <View style={styles.contentCard}>
          <Text style={styles.welcomeText}>Welcome to Recipes Forum!</Text>
          <Text style={styles.description}>
            Share your amazing recipes with the community!
          </Text>
        </View>

        {/* Recipe Posting Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>📝 Post a New Recipe</Text>
          
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
            numberOfLines={3}
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
      <BottomNavigation activeTab="forum" userData={userData} />
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  contentCard: {
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff8c00',
    marginBottom: 15,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 25,
  },

  postButton: {
  backgroundColor: '#4CAF50',
  padding: 12,
  margin: 20,
  borderRadius: 8,
  alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#A5D6A7',
    opacity: 0.6,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 10,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  note: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
  },
  authorInfo: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2196f3',
  },
  authorLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  authorText: {
    fontSize: 14,
    color: '#2196f3',
    fontWeight: '600',
  },
});
