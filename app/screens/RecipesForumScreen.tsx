import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../../config/apiConfig';

export default function RecipesForumScreen() {
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

  const handlePostData = async () => {
    try {
      setIsPosting(true);
      
      // Validate required fields
      if (!formData.title || !formData.description || !formData.cookingTime || !formData.category || !formData.author || !formData.authorEmail) {
        Alert.alert('Error', 'Please fill in all required fields');
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

  const handleGoBack = () => {
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Recipes Forum</Text>
        <View style={styles.placeholder} />
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
          value={formData.title}
          onChangeText={(text) => setFormData({...formData, title: text})}
        />
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Recipe Description *"
          value={formData.description}
          onChangeText={(text) => setFormData({...formData, description: text})}
          multiline
          numberOfLines={3}
        />
        
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Cooking Time (minutes) *"
            value={formData.cookingTime}
            onChangeText={(text) => setFormData({...formData, cookingTime: text})}
            keyboardType="numeric"
          />
          
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Category *"
            value={formData.category}
            onChangeText={(text) => setFormData({...formData, category: text})}
          />
        </View>
        
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Your Name *"
            value={formData.author}
            onChangeText={(text) => setFormData({...formData, author: text})}
          />
          
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Your Email *"
            value={formData.authorEmail}
            onChangeText={(text) => setFormData({...formData, authorEmail: text})}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        
        <Text style={styles.note}>* Required fields</Text>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  backButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 60,
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
});
