import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../../config/apiConfig';
import { useCart } from '../../contexts/CartContext';

interface Ingredient {
  ingredientId: number;
  name: string;
  amount: number;
  unit: string;
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
  authorProfileImage?: string;
  upvotes?: number;
  downvotes?: number;
  created_at: string;
  updatedAt?: string | null;
  userVote?: 'upvote' | 'downvote' | null;
  image?: string;
  imageStatus?: 'none' | 'pending' | 'processing' | 'ready' | 'failed';
  ingredients?: Ingredient[];
  isBookmarked?: boolean;
}

interface UserData {
  user_id: string;
  username: string;
  email: string;
  dateOfBirth: string;
  phone: string;
  points: number;
  created_at?: string;
}

interface Comment {
  _id: string;
  recipeId: string;
  authorEmail: string;
  authorName: string;
  content: string;
  parentCommentId?: string;
  isActive: number;
  createdAt: string;
  updatedAt?: string;
  replies?: Comment[];
}

export default function PostDetailScreen() {
  const params = useLocalSearchParams();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [lastProcessedUpdatedEmail, setLastProcessedUpdatedEmail] = useState<string>('');
  const [originalUserData, setOriginalUserData] = useState<UserData | null>(null);
  const [voteStatusLoaded, setVoteStatusLoaded] = useState(false);
  const [authorProfileImage, setAuthorProfileImage] = useState<string | null>(null);
  
  // Comment-related states
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyingToAuthor, setReplyingToAuthor] = useState<string>('');
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentStats, setCommentStats] = useState({ totalComments: 0, topLevelComments: 0, replies: 0 });
  
  // Comment profile images cache
  const [commentProfileImages, setCommentProfileImages] = useState<{[email: string]: string | null}>({});
  
  // Animation for comment input
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Keyboard handling with animated values for smooth transitions
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const keyboardAnimatedValue = useRef(new Animated.Value(0)).current;

  // Cart-related states
  const [isAddingToCart, setIsAddingToCart] = useState<{[key: number]: boolean}>({});
  const { cartItemCount, loadCartItemCount } = useCart();

  // Function to handle navigation to cart screen
  const handleCartNavigation = () => {
    if (!userData) {
      Alert.alert('Login Required', 'Please log in to view your cart.');
      return;
    }
    
    router.push({
      pathname: './ShoppingCartScreen',
      params: {
        userData: JSON.stringify(userData)
      }
    });
  };

  useEffect(() => {
    if (params.recipe) {
      try {
        const recipeData = JSON.parse(params.recipe as string);
        if (recipeData._id && !recipeData.id) {
          recipeData.id = recipeData._id;
        }
        setRecipe(recipeData);
        setAuthorProfileImage(null);
        setVoteStatusLoaded(recipeData.hasOwnProperty('userVote'));
      } catch (error) {
        console.error('Error parsing recipe data:', error);
      }
    }

    if (params.userData) {
      try {
        const user = JSON.parse(params.userData as string);
        setUserData(user);
        setOriginalUserData(user);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, [params.recipe, params.userData]);

  // Load user vote status only once when component loads and only if missing
  useEffect(() => {
    const loadInitialVoteStatus = async () => {
      if (!userData || !recipe || voteStatusLoaded) return;

      try {
        const response = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}/vote-status/${userData.email}`);
        const data = await response.json();
        
        // Also check bookmark status
        const bookmarkResponse = await fetch(`${API_BASE_URL}/api/bookmarks/${userData.user_id}/${recipe.id}`);
        const bookmarkData = await bookmarkResponse.json();
        
        if (data.success) {
          setRecipe(prev => prev ? {
            ...prev,
            userVote: data.userVote,
            upvotes: data.upvotes,
            downvotes: data.downvotes,
            isBookmarked: bookmarkData.success ? bookmarkData.isBookmarked : false
          } : null);
          setVoteStatusLoaded(true);
        }
      } catch (error) {
        console.error('Error loading vote status:', error);
      }
    };

    loadInitialVoteStatus();
  }, [userData, recipe, voteStatusLoaded]);

  // Load cart item count when user data is available
  useEffect(() => {
    if (userData?.user_id) {
      loadCartItemCount(userData.user_id);
    }
  }, [userData?.user_id, loadCartItemCount]);

  // Handle updated email from EditProfileScreen
  useEffect(() => {
    if (params.updatedEmail && 
        params.updatedEmail !== userData?.email && 
        params.updatedEmail !== lastProcessedUpdatedEmail) {
      setLastProcessedUpdatedEmail(params.updatedEmail as string);
      
      if (originalUserData) {
        const updatedUser = {
          ...originalUserData,
          email: params.updatedEmail as string
        };
        setUserData(updatedUser);
      }
    }
  }, [params.updatedEmail, userData?.email, originalUserData, lastProcessedUpdatedEmail]);

  // Function to refresh user data from API
  const refreshUserData = useCallback(async () => {
    if (userData?.email && originalUserData) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/profile/${userData.email}`);
        const data = await response.json();
        
        if (data.success) {
          const updatedUser: UserData = {
            ...originalUserData,
            username: data.user.username,
            email: data.user.email,
            points: data.user.points || originalUserData.points || 0,
            dateOfBirth: data.user.dateOfBirth || originalUserData.dateOfBirth,
            phone: data.user.phone || originalUserData.phone,
          };
          setUserData(updatedUser);
        }
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }
  }, [userData?.email, originalUserData]);

  // Function to refresh recipe data from API
  const refreshRecipeData = useCallback(async () => {
    if (recipe?.id && userData?.email) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}`);
        const data = await response.json();
        
        if (data.success && data.recipe) {
          // Also get the user vote status
          const voteResponse = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}/vote-status/${userData.email}`);
          const voteData = await voteResponse.json();
          
          // Also check bookmark status
          const bookmarkResponse = await fetch(`${API_BASE_URL}/api/bookmarks/${userData.user_id}/${recipe.id}`);
          const bookmarkData = await bookmarkResponse.json();
          
          const updatedRecipe: Recipe = {
            id: data.recipe._id,
            title: data.recipe.title,
            description: data.recipe.description,
            cookingTime: data.recipe.cookingTime.toString(),
            category: data.recipe.category,
            difficulty: data.recipe.difficulty,
            author: data.recipe.author,
            authorEmail: data.recipe.authorEmail,
            upvotes: voteData.success ? voteData.upvotes : (data.recipe.upvotes || 0),
            downvotes: voteData.success ? voteData.downvotes : (data.recipe.downvotes || 0),
            created_at: data.recipe.createdAt,
            updatedAt: data.recipe.updatedAt,
            userVote: voteData.success ? voteData.userVote : null,
            image: data.recipe.image,
            imageStatus: data.recipe.imageStatus,
            ingredients: data.recipe.ingredients || [],
            isBookmarked: bookmarkData.success ? bookmarkData.isBookmarked : false
          };
          setRecipe(updatedRecipe);
          setVoteStatusLoaded(true);
        }
      } catch (error) {
        console.error('Error refreshing recipe data:', error);
      }
    }
  }, [recipe?.id, userData?.email, userData?.user_id]);

  // Refresh data when screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      if (userData?.user_id && recipe?.id && voteStatusLoaded) {
        const timeoutId = setTimeout(() => {
          refreshRecipeData();
          if (userData?.email !== lastProcessedUpdatedEmail) {
            refreshUserData();
          }
          loadComments();
          loadCommentStats();
          if (userData?.user_id) {
            loadCartItemCount(userData.user_id);
          }
        }, 200);
        
        return () => clearTimeout(timeoutId);
      }
    }, [refreshRecipeData, refreshUserData, userData?.user_id, lastProcessedUpdatedEmail, recipe?.id, voteStatusLoaded, loadCartItemCount])
  );

  // Load author profile image
  useEffect(() => {
    const loadAuthorProfileImage = async () => {
      if (recipe?.authorEmail && !authorProfileImage) {
        try {
          const authorResponse = await fetch(`${API_BASE_URL}/api/users/profile/${recipe.authorEmail}`);
          const authorData = await authorResponse.json();
          if (authorData.success && authorData.user?.profileImageUrl) {
            setAuthorProfileImage(authorData.user.profileImageUrl);
          }
        } catch (error) {
          console.log('Author profile image not found:', error);
        }
      }
    };

    loadAuthorProfileImage();
  }, [recipe?.authorEmail, authorProfileImage]);

  // Load comments when recipe is loaded
  useEffect(() => {
    if (recipe?.id) {
      loadComments();
      loadCommentStats();
    }
  }, [recipe?.id]);

  // Keyboard event listeners with smooth animations
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        const newHeight = e.endCoordinates.height;
        setKeyboardHeight(newHeight);
        setIsKeyboardVisible(true);
        
        Animated.timing(keyboardAnimatedValue, {
          toValue: newHeight,
          duration: 250, 
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
        
        Animated.timing(keyboardAnimatedValue, {
          toValue: 0,
          duration: 250, 
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardWillShowListener = Platform.OS === 'ios' ? Keyboard.addListener(
      'keyboardWillShow',
      (e) => {
        const newHeight = e.endCoordinates.height;
        setKeyboardHeight(newHeight);
        setIsKeyboardVisible(true);
        
        // Start animation immediately on iOS
        Animated.timing(keyboardAnimatedValue, {
          toValue: newHeight,
          duration: e.duration || 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start();
      }
    ) : null;

    const keyboardWillHideListener = Platform.OS === 'ios' ? Keyboard.addListener(
      'keyboardWillHide',
      (e) => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
        
        Animated.timing(keyboardAnimatedValue, {
          toValue: 0,
          duration: e.duration || 250,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }).start();
      }
    ) : null;

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
      keyboardWillShowListener?.remove();
      keyboardWillHideListener?.remove();
    };
  }, [keyboardAnimatedValue]);

  // Load user data from storage
  useFocusEffect(
    useCallback(() => {
      const loadUserData = async () => {
        try {
          const storedUserData = await AsyncStorage.getItem('userData');
          if (storedUserData) {
            const parsedData = JSON.parse(storedUserData);
            setUserData(parsedData);
            setOriginalUserData(parsedData);
            // Load cart count after user data is set
            if (parsedData?.user_id) {
              setTimeout(() => {
                loadCartItemCount(parsedData.user_id);
              }, 100);
            }
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      };

      loadUserData();
    }, [])
  );

  const loadComments = async () => {
    if (!recipe?.id) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}/comments?page=1&limit=50`);
      const data = await response.json();
      
      if (data.success) {
        setComments(data.comments);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setCommentsLoaded(true);
    }
  };

  const loadCommentStats = async () => {
    if (!recipe?.id) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}/comments/stats`);
      const data = await response.json();
      
      if (data.success) {
        setCommentStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading comment stats:', error);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !userData || !recipe) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    if (commentText.length > 1000) {
      Alert.alert('Error', 'Comment cannot exceed 1000 characters');
      return;
    }

    setIsPostingComment(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: commentText.trim(),
          authorEmail: userData.email,
          authorName: userData.username,
          parentCommentId: replyingTo
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCommentText('');
        setReplyingTo(null);
        setReplyingToAuthor('');
        
        // Reload comments and stats
        await loadComments();
        await loadCommentStats();
        
        // Animate input back down
        Animated.timing(slideAnimation, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start();
      } else {
        Alert.alert('Error', data.error || 'Failed to post comment');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleReply = (commentId: string, authorName: string) => {
    setReplyingTo(commentId);
    setReplyingToAuthor(authorName);
    setCommentText(`@${authorName} `);
    
    // Animate input up and auto-scroll
    Animated.timing(slideAnimation, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
    
    // Scroll to bottom to show the reply input
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyingToAuthor('');
    setCommentText('');
    
    // Animate input back down
    Animated.timing(slideAnimation, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  const formatCommentDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}h ago`;
      
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `${diffInDays}d ago`;
      
      return date.toLocaleDateString();
    } catch {
      return 'Unknown time';
    }
  };

  const loadCommentProfileImage = async (email: string) => {
    // Check if already loaded or loading
    if (commentProfileImages[email] !== undefined) {
      return commentProfileImages[email];
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/profile/${email}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user.profileImageUrl) {
          setCommentProfileImages(prev => ({
            ...prev,
            [email]: data.user.profileImageUrl
          }));
          return data.user.profileImageUrl;
        } else {
          // Set to null to indicate no image available
          setCommentProfileImages(prev => ({
            ...prev,
            [email]: null
          }));
          return null;
        }
      }
    } catch (error) {
      console.log('Comment profile image not found for:', email);
      setCommentProfileImages(prev => ({
        ...prev,
        [email]: null
      }));
    }
    return null;
  };

  // Load profile images when comments are loaded
  useEffect(() => {
    if (comments.length > 0) {
      const loadAllCommentImages = async () => {
        const emailsToLoad = new Set<string>();
        
        // Collect all unique emails from comments and replies
        comments.forEach(comment => {
          emailsToLoad.add(comment.authorEmail);
          if (comment.replies) {
            comment.replies.forEach(reply => {
              emailsToLoad.add(reply.authorEmail);
            });
          }
        });

        // Load images for emails we haven't processed yet
        for (const email of emailsToLoad) {
          if (commentProfileImages[email] === undefined) {
            loadCommentProfileImage(email);
          }
        }
      };

      loadAllCommentImages();
    }
  }, [comments, commentProfileImages]);

  const renderComment = (comment: Comment, isReply: boolean = false) => {
    const profileImage = commentProfileImages[comment.authorEmail];
    
    return (
      <View key={comment._id} style={[styles.commentItem, isReply && styles.replyItem]}>
        <View style={styles.commentHeader}>
          <View style={styles.commentAuthorContainer}>
            <View style={styles.commentAuthorAvatar}>
              {profileImage ? (
                <Image 
                  source={{ uri: profileImage }} 
                  style={styles.commentAuthorImage}
                />
              ) : (
                <Text style={styles.commentAuthorInitials}>
                  {comment.authorName.substring(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => handleViewCommentAuthorProfile(comment.authorEmail)}>
              <Text style={[styles.commentAuthorName, styles.clickableAuthorName]}>{comment.authorName}</Text>
            </TouchableOpacity>
            <Text style={styles.commentTime}>{formatCommentDate(comment.createdAt)}</Text>
          </View>
        </View>
        
        <Text style={styles.commentContent}>{comment.content}</Text>
        
        {!isReply && (
          <TouchableOpacity 
            style={styles.replyButton}
            onPress={() => handleReply(comment._id, comment.authorName)}
          >
            <Text style={styles.replyButtonText}>Reply</Text>
          </TouchableOpacity>
        )}
        
        {comment.replies && comment.replies.length > 0 && (
          <View style={styles.repliesContainer}>
            {comment.replies.map((reply) => renderComment(reply, true))}
          </View>
        )}
      </View>
    );
  };

  const handleInputFocus = () => {
  };

  const handleBack = () => {
    router.back();
  };

  const handleViewAuthorProfile = () => {
    if (recipe?.authorEmail) {
      router.push({
        pathname: './ViewProfileScreen',
        params: { 
          email: recipe.authorEmail,
          currentUserEmail: userData?.email || ''
        }
      });
    }
  };

  const handleViewCommentAuthorProfile = (authorEmail: string) => {
    if (authorEmail) {
      router.push({
        pathname: './ViewProfileScreen',
        params: { 
          email: authorEmail,
          currentUserEmail: userData?.email || ''
        }
      });
    }
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

  const getDateInfo = (recipe: Recipe) => {
    return {
      posted: {
        label: 'Posted:',
        icon: 'calendar-outline',
        value: formatDate(recipe.created_at)
      },
      edited: recipe.updatedAt ? {
        label: 'Last edited:',
        icon: 'create-outline',
        value: formatDate(recipe.updatedAt)
      } : null
    };
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

  const handleDelete = async () => {
    if (!recipe || !userData) return;

    Alert.alert(
      'Delete Post',
      `Are you sure you want to delete "${recipe.title}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}`, {
                method: 'DELETE',
              });

              const result = await response.json();

              if (result.success) {
                Alert.alert(
                  'Your post has been deleted successfully!',
                  '',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        router.back();
                      }
                    }
                  ]
                );
              } else {
                Alert.alert('Error', result.error || 'Failed to delete post');
              }
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleEdit = () => {
    setShowMoreOptions(false); // Close the options menu
    if (recipe && userData) {
      router.push({
        pathname: './EditPostScreen',
        params: {
          recipe: JSON.stringify(recipe),
          userData: JSON.stringify(userData)
        }
      });
    }
  };

  const handleMoreOptions = () => {
    setShowMoreOptions(true);
  };

  const handleVote = async (voteType: 'upvote' | 'downvote') => {
    if (!userData || !recipe) {
      Alert.alert('Error', 'Please login to vote');
      return;
    }

    try {
      // Determine the actual vote type to send
      let actualVoteType = voteType;
      if (recipe.userVote === voteType) {
        // If clicking the same vote, remove it
        actualVoteType = 'remove' as any;
      }

      const response = await fetch(`${API_BASE_URL}/api/recipes/${recipe.id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voteType: actualVoteType,
          userEmail: userData.email
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update the recipe with new vote data
        setRecipe(prev => prev ? {
          ...prev,
          upvotes: data.upvotes,
          downvotes: data.downvotes,
          userVote: data.userVote
        } : null);
      } else {
        Alert.alert('Error', data.error || 'Failed to vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to vote. Please try again.');
    }
  };

  const handleBookmark = async (recipeId: string) => {
    if (!userData || !recipe) {
      Alert.alert('Error', 'Please login to bookmark recipes');
      return;
    }

    try {
      const isCurrentlyBookmarked = recipe.isBookmarked;
      const method = isCurrentlyBookmarked ? 'DELETE' : 'POST';

      // Optimistic update
      setRecipe(prev => prev ? { ...prev, isBookmarked: !isCurrentlyBookmarked } : null);

      const response = await fetch(`${API_BASE_URL}/api/bookmarks`, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userData.user_id,
          recipeId: recipeId
        }),
      });

      const data = await response.json();

      if (!data.success) {
        // Revert optimistic update
        setRecipe(prev => prev ? { ...prev, isBookmarked: isCurrentlyBookmarked } : null);
        Alert.alert('Error', data.error || 'Failed to update bookmark');
      }
    } catch (error) {
      // Revert optimistic update
      setRecipe(prev => prev ? { ...prev, isBookmarked: recipe.isBookmarked } : null);
      console.error('Error bookmarking:', error);
      Alert.alert('Error', 'Failed to update bookmark. Please try again.');
    }
  };

  // Smart quantity conversion for shopping cart with realistic package sizes
  const getShoppingQuantity = async (amount: number, unit: string, ingredientId: number): Promise<number> => {
    try {
      // For countable units, handle them directly first
      const unitLower = unit.toLowerCase();
      if (unitLower === 'cloves' || unitLower === 'pcs' || 
          unitLower === 'slices' || unitLower === 'bunch') {
        // For countable units, try to get package info to be smart about it
        try {
          const response = await fetch(`${API_BASE_URL}/api/ingredients/${ingredientId}`);
          const data = await response.json();
          
          if (data.success) {
            const ingredient = data.ingredient;
            const packageSize = parseFloat(ingredient.package_size) || 1;
            const packageUnit = ingredient.package_unit || 'piece';
            
            // If package is also countable, calculate packages needed
            const packageUnitLower = packageUnit.toLowerCase();
            if (packageUnitLower === 'pcs' || packageUnitLower === 'bunch' || 
                packageUnitLower === 'cloves' || packageUnitLower === 'slices') {
              // Use a reasonable conversion factor
              let conversionFactor = 1;
              if (unitLower === 'cloves' && packageUnitLower === 'bunch') {
                conversionFactor = 8; // 1 bunch is 8 cloves
              }
              // For same units, conversionFactor = 1
              
              const packagesNeeded = Math.ceil(amount / (packageSize * conversionFactor));
              return Math.max(1, packagesNeeded);
            }
          }
        } catch (error) {
          console.log('Could not get package info for countable unit, using recipe amount');
        }
        
        // Fallback for countable units: use recipe amount
        return Math.max(1, Math.ceil(amount));
      }
      
      // Get ingredient package information for non-countable units
      const response = await fetch(`${API_BASE_URL}/api/ingredients/${ingredientId}`);
      const data = await response.json();
      
      if (!data.success) {
        console.warn('Failed to get ingredient package info, using fallback logic');
        return getShoppingQuantityFallback(amount, unit, null, null);
      }
      
      const ingredient = data.ingredient;
      const packageSize = parseFloat(ingredient.package_size) || 1;
      const packageUnit = ingredient.package_unit || 'piece';
      
      // Special handling for ingredients sold by pieces (pcs)
      if (packageUnit.toLowerCase() === 'pcs') {
        // Calculate how many packages needed based on package size
        // For example if recipe needs 10 eggs and package has 12 eggs, buy 1 package
        const packagesNeeded = Math.ceil(amount / packageSize);
        return Math.max(1, packagesNeeded);
      }
      
      // Convert units to same base for comparison
      const recipeAmountInBaseUnit = convertToBaseUnit(amount, unit);
      const packageSizeInBaseUnit = convertToBaseUnit(packageSize, packageUnit);
      
      // Check if units are compatible for comparison
      if (recipeAmountInBaseUnit && packageSizeInBaseUnit && areUnitsCompatible(unit, packageUnit)) {
        // Calculate how many packages needed
        const packagesNeeded = Math.ceil(recipeAmountInBaseUnit / packageSizeInBaseUnit);
        return Math.max(1, packagesNeeded);
      }
      
      // Fallback for non-convertible or incompatible units
      console.warn(`Unit mismatch: Recipe uses "${unit}" but package is sold in "${packageUnit}". Using fallback logic.`);
      return getShoppingQuantityFallback(amount, unit, ingredient.name, packageUnit);
      
    } catch (error) {
      console.error('Error getting package info:', error);
      return getShoppingQuantityFallback(amount, unit, null, null);
    }
  };

  // Convert units to grams/ml for comparison
  const convertToBaseUnit = (amount: number, unit: string): number | null => {
    const unitLower = unit.toLowerCase();
    
    // Weight conversions to grams
    if (unitLower === 'kg') return amount * 1000; // kg → g
    if (unitLower === 'grams') return amount; // grams → g
    if (unitLower === 'oz') return amount * 28.35; // oz → g (approx)
    if (unitLower === 'lbs') return amount * 453.6; // lbs → g (approx)
    
    // Volume conversions to ml
    if (unitLower === 'liters') return amount * 1000; // liters → ml
    if (unitLower === 'ml') return amount; // ml → ml
    if (unitLower === 'cups') return amount * 240; // cups → ml (approx)
    if (unitLower === 'tbsp') return amount * 15; // tbsp → ml
    if (unitLower === 'tsp') return amount * 5; // tsp → ml
    
    // Countable items
    if (unitLower === 'pcs' || unitLower === 'cloves' || 
        unitLower === 'slices' || unitLower === 'bunch') return amount;
    
    return null;
  };

  // Check if two units are compatible for conversion/comparison
  const areUnitsCompatible = (unit1: string, unit2: string): boolean => {
    const getUnitType = (unit: string): 'weight' | 'volume' | 'count' | 'unknown' => {
      const unitLower = unit.toLowerCase();
      
      // Weight units
      if (unitLower === 'kg' || unitLower === 'grams' ||
          unitLower === 'oz' || unitLower === 'lbs') {
        return 'weight';
      }
      
      // Volume units
      if (unitLower === 'liters' || unitLower === 'ml' || 
          unitLower === 'cups' || unitLower === 'tbsp' || 
          unitLower === 'tsp') {
        return 'volume';
      }
      
      // Countable units
      if (unitLower === 'pcs' || unitLower === 'cloves' ||
          unitLower === 'slices' || unitLower === 'bunch') {
        return 'count';
      }
      
      return 'unknown';
    };
    
    const type1 = getUnitType(unit1);
    const type2 = getUnitType(unit2);
    
    // Units are compatible if they are the same type (weight-weight, volume-volume, count-count)
    return type1 === type2 && type1 !== 'unknown';
  };

  // Fallback logic when package info is not available or units are incompatible
  const getShoppingQuantityFallback = (amount: number, unit: string, ingredientName: string | null = null, packageUnit: string | null = null): number => {
    const unitLower = unit.toLowerCase();
    const ingredientLower = ingredientName?.toLowerCase() || '';
    const packageUnitLower = packageUnit?.toLowerCase() || '';
    
    // Check if package is sold by pieces first
    if (packageUnitLower === 'pcs') {
      const defaultPackageSize = 6;
      return Math.max(1, Math.ceil(amount / defaultPackageSize));
    }
    
    // Countable units - use recipe amount (makes sense for pieces, etc.)
    if (unitLower === 'pcs' || unitLower === 'cloves' ||
        unitLower === 'slices') {
      return Math.ceil(amount); // Round up to ensure enough
    }
    
    // Weight/volume units - assume 1 package will cover recipe needs
    // This handles cases like "1 cups fish" or "500 grams flour"
    if (unitLower === 'grams' || unitLower === 'kg' ||
        unitLower === 'cups' || unitLower === 'tbsp' ||
        unitLower === 'tsp' || unitLower === 'ml' ||
        unitLower === 'liters' || unitLower === 'oz' ||
        unitLower === 'lbs') {
      
      // For very large amounts, might need multiple packages
      if (amount > 50) {
        return Math.ceil(amount / 20);
      }
      return 1;
    }
    
    // For bunch units - use recipe amount
    if (unitLower === 'bunch') {
      return Math.ceil(amount);
    }
    
    // Default: use recipe amount for completely unknown units
    return Math.max(1, Math.ceil(amount));
  };

  // Add ingredient to shopping cart
  const addToCart = async (ingredient: Ingredient) => {
    if (!userData) {
      Alert.alert('Login Required', 'Please log in to add items to your cart.');
      return;
    }

    setIsAddingToCart(prev => ({ ...prev, [ingredient.ingredientId]: true }));

    // Convert recipe amount to smart shopping quantity
    const shoppingQuantity = await getShoppingQuantity(ingredient.amount, ingredient.unit, ingredient.ingredientId);

    // Get ingredient package size for the success message
    let packageInfo = '';
    try {
      const ingredientResponse = await fetch(`${API_BASE_URL}/api/ingredients/${ingredient.ingredientId}`);
      const ingredientData = await ingredientResponse.json();
      if (ingredientData.success && ingredientData.ingredient?.package_size && ingredientData.ingredient?.package_unit) {
        const packageSize = parseFloat(ingredientData.ingredient.package_size);
        const formattedSize = packageSize % 1 === 0 ? Math.floor(packageSize).toString() : packageSize.toString();
        packageInfo = `${formattedSize} ${ingredientData.ingredient.package_unit}`;
      }
    } catch (error) {
      console.log('Could not fetch ingredient package info:', error);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/cart/${userData.user_id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ingredientId: ingredient.ingredientId,
          quantity: shoppingQuantity
        }),
      });

      const data = await response.json();

      if (data.success) {
        const quantityText = shoppingQuantity === 1 ? '1' : `${shoppingQuantity}`;
        const successMessage = packageInfo 
          ? `${quantityText} ${ingredient.name} (${packageInfo}) added to cart!`
          : `${quantityText} ${ingredient.name} added to cart!`;
        Alert.alert('Success', successMessage);
        // Refresh cart count after successful addition
        if (userData?.user_id) {
          setTimeout(() => {
            loadCartItemCount(userData.user_id);
          }, 500);
        }
      } else {
        Alert.alert('Error', data.error || 'Failed to add item to cart');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add item to cart. Please try again.');
    } finally {
      setIsAddingToCart(prev => ({ ...prev, [ingredient.ingredientId]: false }));
    }
  };

  // Check if current user is the owner of the post
  const isOwner = userData && recipe && userData.email === recipe.authorEmail;

  if (!recipe) {
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
          <Text style={styles.title}>Post Details</Text>
          <TouchableOpacity style={styles.cartButton} onPress={handleCartNavigation}>
            <View style={styles.cartIconContainer}>
              <Ionicons name="cart-outline" size={24} color="#666" />
              {cartItemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>
                    {Math.floor(cartItemCount) > 99 ? '99+' : Math.floor(cartItemCount)}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Post not found</Text>
        </View>
      </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <View style={styles.backButtonContent}>
              <Ionicons name="chevron-back" size={20} color="#007AFF" />
              <Text style={styles.backButtonText}>Back</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>Post Details</Text>
          <TouchableOpacity style={styles.cartButton} onPress={handleCartNavigation}>
            <View style={styles.cartIconContainer}>
              <Ionicons name="cart-outline" size={24} color="#666" />
              {cartItemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>
                    {Math.floor(cartItemCount) > 99 ? '99+' : Math.floor(cartItemCount)}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView} 
          contentContainerStyle={styles.contentContainer}
        >
          <View style={styles.recipeCard}>
            <View style={styles.recipeHeader}>
              <View style={styles.titleRow}>
                <Text style={styles.recipeTitle}>{recipe.title}</Text>
                {isOwner && (
                  <TouchableOpacity style={styles.moreOptionsButton} onPress={handleMoreOptions}>
                    <Text style={styles.moreOptionsButtonText}>⋯</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{recipe.category}</Text>
              </View>
            </View>

            <View style={styles.metaInfo}>
              <View style={styles.metaItem}>
                <View style={styles.metaLabelContainer}>
                  <Ionicons name="time-outline" size={16} color="#666" />
                  <Text style={styles.metaLabel}>Cooking Time:</Text>
                </View>
                <Text style={styles.metaValue}>{recipe.cookingTime} minutes</Text>
              </View>
              {recipe.difficulty && (
                <View style={styles.metaItem}>
                  <View style={styles.metaLabelContainer}>
                    <Ionicons name="restaurant-outline" size={16} color="#666" />
                    <Text style={styles.metaLabel}>Difficulty:</Text>
                  </View>
                  <Text style={[styles.metaValue, styles.difficultyValue, { color: getDifficultyColor(recipe.difficulty) }]}>
                    {recipe.difficulty}
                  </Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <View style={styles.metaLabelContainer}>
                  <Ionicons name="person-outline" size={16} color="#666" />
                  <Text style={styles.metaLabel}>Author:</Text>
                </View>
                <View style={styles.authorContainer}>
                  <View style={styles.authorProfileImageContainer}>
                    {authorProfileImage ? (
                      <Image 
                        source={{ uri: authorProfileImage }} 
                        style={styles.authorProfileImage}
                      />
                    ) : (
                      <View style={[styles.authorProfileImage, styles.authorInitials]}>
                        <Text style={styles.authorInitialsText}>
                          {recipe.author.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={handleViewAuthorProfile}>
                    <Text style={[styles.metaValue, styles.authorName]}>{recipe.author}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.metaItem}>
                <View style={styles.metaLabelContainer}>
                  <Ionicons name="calendar-outline" size={16} color="#666" />
                  <Text style={styles.metaLabel}>{getDateInfo(recipe).posted.label}</Text>
                </View>
                <Text style={styles.metaValue}>
                  {getDateInfo(recipe).posted.value}
                </Text>
              </View>
              {getDateInfo(recipe).edited && (
                <View style={styles.metaItem}>
                  <View style={styles.metaLabelContainer}>
                    <Ionicons name="create-outline" size={16} color="#666" />
                    <Text style={styles.metaLabel}>{getDateInfo(recipe).edited!.label}</Text>
                  </View>
                  <Text style={[styles.metaValue, styles.editedText]}>
                    {getDateInfo(recipe).edited!.value}
                  </Text>
                </View>
              )}
            </View>

            {/* Recipe Image */}
            {recipe.imageStatus === 'ready' && recipe.image && (
              <View style={styles.imageSection}>
                <Image 
                  source={{ uri: recipe.image }} 
                  style={styles.recipeImage}
                />
              </View>
            )}
            {recipe.imageStatus === 'pending' && (
              <View style={styles.imageStatusSection}>
                <Text style={styles.imageStatusText}>Image pending...</Text>
              </View>
            )}
            {recipe.imageStatus === 'processing' && (
              <View style={styles.imageStatusSection}>
                <Text style={styles.imageStatusText}>Image processing...</Text>
              </View>
            )}
            {recipe.imageStatus === 'failed' && (
              <View style={styles.imageStatusSection}>
                <Text style={styles.imageStatusText}>Image upload failed</Text>
              </View>
            )}

            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{recipe.description}</Text>
            </View>

            {/* Ingredients Section */}
            {recipe.ingredients && recipe.ingredients.length > 0 && (
              <View style={styles.ingredientsSection}>
                <Text style={styles.sectionTitle}>Ingredients</Text>
                <View style={styles.ingredientsList}>
                  {recipe.ingredients.map((ingredient, index) => (
                    <View key={index} style={styles.ingredientItem}>
                      <View style={styles.ingredientInfo}>
                        <View style={styles.ingredientAmountContainer}>
                          <Text style={styles.ingredientAmount}>{ingredient.amount}</Text>
                          <Text style={styles.ingredientUnit}>{ingredient.unit}</Text>
                        </View>
                        <Text style={styles.ingredientName}>{ingredient.name}</Text>
                      </View>
                      <TouchableOpacity 
                        style={[
                          styles.addToCartButton,
                          isAddingToCart[ingredient.ingredientId] && styles.addToCartButtonDisabled
                        ]}
                        onPress={() => addToCart(ingredient)}
                        disabled={isAddingToCart[ingredient.ingredientId]}
                      >
                        <Text style={styles.addToCartButtonText}>
                          {isAddingToCart[ingredient.ingredientId] ? '...' : '+'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Voting and Comments Section */}
            <View style={styles.actionsContainer}>
              {/* Voting Controls */}
              {voteStatusLoaded ? (
                <View style={styles.votingSection}>
                  <TouchableOpacity 
                    style={[styles.voteButton, recipe.userVote === 'upvote' && styles.voteButtonActive]}
                    onPress={() => handleVote('upvote')}
                  >
                    <Ionicons 
                      name="chevron-up" 
                      size={18} 
                      color={recipe.userVote === 'upvote' ? 'white' : '#666'} 
                    />
                  </TouchableOpacity>
                  
                  <View style={styles.netVotes}>
                    <Text style={styles.netVotesText}>
                      {(recipe.upvotes || 0) - (recipe.downvotes || 0)}
                    </Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={[styles.voteButton, recipe.userVote === 'downvote' && styles.voteButtonActive]}
                    onPress={() => handleVote('downvote')}
                  >
                    <Ionicons 
                      name="chevron-down" 
                      size={18} 
                      color={recipe.userVote === 'downvote' ? 'white' : '#666'} 
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.votingSection}>
                  <View style={[styles.voteButton, { opacity: 0.5 }]}>
                    <Ionicons name="chevron-up" size={18} color="#999" />
                  </View>
                  
                  <View style={styles.netVotes}>
                    <Text style={styles.netVotesText}>
                      {(recipe.upvotes || 0) - (recipe.downvotes || 0)}
                    </Text>
                  </View>
                  
                  <View style={[styles.voteButton, { opacity: 0.5 }]}>
                    <Ionicons name="chevron-down" size={18} color="#999" />
                  </View>
                </View>
              )}

              {/* Comment Count */}
              <View style={styles.commentSection}>
                <Ionicons name="chatbubble-outline" size={16} color="#666" />
                <Text style={styles.commentCountText}>{commentStats.totalComments}</Text>
              </View>

              {/* Bookmark Button */}
              <TouchableOpacity 
                style={styles.bookmarkButton}
                onPress={() => handleBookmark(recipe.id?.toString() || '')}
              >
                <Ionicons 
                  name={recipe.isBookmarked ? "star" : "star-outline"} 
                  size={20} 
                  color={recipe.isBookmarked ? "#FFD700" : "#666"} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            {commentsLoaded ? (
              comments.length > 0 ? (
                <View style={styles.commentsList}>
                  {comments.map((comment) => renderComment(comment))}
                </View>
              ) : (
                <View style={styles.noCommentsContainer}>
                  <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
                </View>
              )
            ) : (
              <View style={styles.loadingComments}>
                <Text style={styles.loadingText}>Loading comments...</Text>
              </View>
            )}
          </View>
          
          {/* Add dynamic padding at the bottom for the fixed input and keyboard */}
          <Animated.View style={{ 
            height: keyboardAnimatedValue.interpolate({
              inputRange: [0, 400], 
              outputRange: [100, 180],
              extrapolate: 'clamp'
            })
          }} />
        </ScrollView>

        {/* Fixed Comment Input */}
        <Animated.View style={[
          styles.commentInputContainer,
          {
            backgroundColor: isKeyboardVisible ? '#f8f9fa' : 'white',
            transform: [
              {
                translateY: Animated.add(
                  keyboardAnimatedValue.interpolate({
                    inputRange: [0, 400],
                    outputRange: [0, -400],
                    extrapolate: 'clamp'
                  }),
                  slideAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -10],
                  })
                )
              }
            ],
          }
        ]}>
          {replyingTo && (
            <View style={styles.replyIndicator}>
              <Text style={styles.replyIndicatorText}>
                Replying to {replyingToAuthor}
              </Text>
              <TouchableOpacity onPress={handleCancelReply} style={styles.cancelReplyButton}>
                <Text style={styles.cancelReplyText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.commentInputRow}>
            <View style={styles.commentInputWrapper}>
              <TextInput
                style={[
                  styles.commentInput,
                  isKeyboardVisible && styles.commentInputFocused
                ]}
                placeholder={userData ? "Add your reply..." : "Please login to comment"}
                placeholderTextColor="#999"
                value={commentText}
                onChangeText={setCommentText}
                onFocus={handleInputFocus}
                multiline
                maxLength={1000}
                editable={!!userData}
              />
              <Text style={styles.characterCount}>
                {commentText.length}/1000
              </Text>
            </View>
            
            <TouchableOpacity
              style={[styles.postButton, (!commentText.trim() || isPostingComment || !userData) && styles.postButtonDisabled]}
              onPress={handlePostComment}
              disabled={!commentText.trim() || isPostingComment || !userData}
            >
              <Text style={[styles.postButtonText, (!commentText.trim() || isPostingComment || !userData) && styles.postButtonTextDisabled]}>
                {isPostingComment ? '...' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* More Options Modal */}
      <Modal
        transparent={true}
        visible={showMoreOptions}
        animationType="fade"
        onRequestClose={() => setShowMoreOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMoreOptions(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleEdit}
            >
              <Text style={styles.optionText}>Edit post</Text>
            </TouchableOpacity>
            
            <View style={styles.optionSeparator} />
            
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                setShowMoreOptions(false);
                handleDelete();
              }}
            >
              <Text style={[styles.optionText, styles.deleteText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  cartButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF6347',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  moreOptionsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginLeft: 10,
  },
  moreOptionsButtonText: {
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 120, // Position below header
    paddingRight: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 8,
    minWidth: 140,
    maxWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionSeparator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  optionText: {
    fontSize: 15,
    color: '#000',
    fontWeight: '400',
  },
  deleteText: {
    color: '#ff4444',
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
    marginLeft: 6,
  },
  metaLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  authorName: {
    color: '#333333',
    textDecorationLine: 'underline',
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorProfileImageContainer: {
    marginRight: 8,
  },
  authorProfileImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  authorInitials: {
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorInitialsText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  editedText: {
    color: '#ff8c00',
    fontStyle: 'italic',
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

  ingredientsSection: {
    marginBottom: 20,
  },
  ingredientsList: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    justifyContent: 'space-between',
  },
  ingredientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ingredientAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    minWidth: 80,
    marginRight: 12,
  },
  ingredientAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff8c00',
    marginRight: 4,
  },
  ingredientUnit: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  ingredientName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  addToCartButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 20,
    width: 35,
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  addToCartButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addToCartButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
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
  votingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 5,
    paddingHorizontal: 15,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    marginTop: 8,
    borderRadius: 20,
    width: 110,
    height: 40,                  
    alignSelf: 'flex-start',     
  },
  commentSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 5,
    paddingHorizontal: 15,
    backgroundColor: '#fafafa',
    marginTop: 8,
    borderRadius: 20,
    width: 60,
    height: 40,                  
    alignSelf: 'flex-start',   
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 15,
  },
  votingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  voteButton: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,        
    borderRadius: 15,
    backgroundColor: '#f8f8f8',
    minWidth: 30,                
    justifyContent: 'center',
    marginHorizontal: 2,         
  },
  voteButtonActive: {
    backgroundColor: '#ff8c00',
  },
  voteIcon: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
  voteIconActive: {
    color: 'white',
  },
  netVotes: {
    paddingVertical: 4,
    paddingHorizontal: 8,        
    backgroundColor: '#e8f4f8',
    borderRadius: 12,
    minWidth: 30,                
    alignItems: 'center',
    marginHorizontal: 2,         
  },
  netVotesText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  commentCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 6,
  },
  
  // Comments Section Styles
  commentsSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  commentsList: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  noCommentsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noCommentsText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  loadingComments: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  
  commentItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  replyItem: {
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: '#e0e0e0',
    paddingLeft: 15,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    marginTop: 10,
  },
  commentHeader: {
    marginBottom: 8,
  },
  commentAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAuthorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  commentAuthorImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentAuthorInitials: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  commentAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 10,
  },
  clickableAuthorName: {
    color: '#000000ff',
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
  },
  commentContent: {
    fontSize: 15,
    color: '#444',
    lineHeight: 20,
    marginBottom: 8,
  },
  replyButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  replyButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  repliesContainer: {
    marginTop: 10,
  },
  
  commentInputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 15,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 10,
  },
  replyIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyIndicatorText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  cancelReplyButton: {
    padding: 4,
  },
  cancelReplyText: {
    fontSize: 16,
    color: '#999',
    fontWeight: 'bold',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  commentInputWrapper: {
    flex: 1,
    marginRight: 10,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#f8f8f8',
  },
  commentInputFocused: {
    borderColor: '#007AFF',
    backgroundColor: 'white',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  postButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
    marginBottom: 20,
  },
  postButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  postButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  postButtonTextDisabled: {
    color: '#999',
  },
  imageSection: {
    marginBottom: 20,
  },
  recipeImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 10,
  },
  imageStatusSection: {
    marginBottom: 20,
    paddingVertical: 20,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
  },
  imageStatusText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  bookmarkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 5,
    paddingHorizontal: 15,
    backgroundColor: '#fafafa',
    marginTop: 8,
    borderRadius: 20,
    width: 50,
    height: 40,                  
    alignSelf: 'flex-start',   
  },
});
