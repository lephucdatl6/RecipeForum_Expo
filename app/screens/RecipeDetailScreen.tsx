import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Recipe {
  id: number;
  title: string;
  description: string;
  cookingTime: string;
  category: string;
  difficulty?: string;
  author: string;
  authorEmail: string;
  created_at: string;
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

export default function RecipeDetailScreen() {
  const params = useLocalSearchParams();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    if (params.recipe) {
      try {
        const recipeData = JSON.parse(params.recipe as string);
        setRecipe(recipeData);
      } catch (error) {
        console.error('Error parsing recipe data:', error);
      }
    }

    if (params.userData) {
      try {
        const user = JSON.parse(params.userData as string);
        setUserData(user);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, [params.recipe, params.userData]);

  const handleBack = () => {
    router.back();
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

  if (!recipe) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Recipe Details</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Recipe not found</Text>
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
        <Text style={styles.title}>Recipe Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.recipeCard}>
          <View style={styles.recipeHeader}>
            <Text style={styles.recipeTitle}>{recipe.title}</Text>
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
              <Text style={styles.metaValue}>{recipe.author}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>📅 Posted:</Text>
              <Text style={styles.metaValue}>{formatDate(recipe.created_at)}</Text>
            </View>
          </View>

          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{recipe.description}</Text>
          </View>
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
  recipeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
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
});
