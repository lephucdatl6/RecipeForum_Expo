import axios from 'axios';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../../config/apiConfig';

const API_URL = `${API_BASE_URL}/api/auth`;

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatDateInput = (text: string, previousText: string = '') => {
    // Remove all nonnumeric characters
    const numbers = text.replace(/\D/g, '');
    
    // If user is deleting (current length < previous length), handle it properly
    if (text.length < previousText.length) {
      if (previousText.endsWith('-') && !text.endsWith('-')) {
        const numbersFromPrev = previousText.replace(/\D/g, '');
        const newNumbers = numbersFromPrev.slice(0, -1);
        return formatDateInput(newNumbers);
      }
      return formatDateString(numbers);
    }
    
    // For normal input, format the numbers
    return formatDateString(numbers);
  };

  const formatDateString = (numbers: string) => {
    // Limit to 8 digits (DDMMYYYY)
    const limited = numbers.slice(0, 8);
    
    // Add dashes automatically
    if (limited.length >= 5) {
      return `${limited.slice(0, 2)}-${limited.slice(2, 4)}-${limited.slice(4)}`;
    } else if (limited.length >= 3) {
      return `${limited.slice(0, 2)}-${limited.slice(2)}`;
    }
    
    return limited;
  };

  const handleDateChange = (text: string) => {
    const formatted = formatDateInput(text, dateOfBirth);
    setDateOfBirth(formatted);
    if (error) setError('');
  };

  const convertDateForBackend = (ddmmyyyy: string) => {
    if (ddmmyyyy.length === 10) {
      const [day, month, year] = ddmmyyyy.split('-');
      return `${year}-${month}-${day}`;
    }
    return ddmmyyyy;
  };

  const validateForm = () => {
    setError('');

    if (!username.trim()) {
      setError('Username is required');
      return false;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters long');
      return false;
    }
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!password.trim()) {
      setError('Password is required');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (!dateOfBirth.trim()) {
      setError('Date of birth is required');
      return false;
    }
    if (!phone.trim()) {
      setError('Phone number is required');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Date format validation (DD-MM-YYYY)
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    if (!dateRegex.test(dateOfBirth)) {
      setError('Date of birth must be in DD-MM-YYYY format');
      return false;
    }

    // Validate date (not in future, not too old)
    const [day, month, year] = dateOfBirth.split('-').map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    
    // Check if date is valid
    if (birthDate.getDate() !== day || birthDate.getMonth() !== month - 1 || birthDate.getFullYear() !== year) {
      setError('Please enter a valid date');
      return false;
    }
    
    if (birthDate > today) {
      setError('Date of birth cannot be in the future');
      return false;
    }
    
    const age = today.getFullYear() - year;
    if (age > 120) {
      setError('Please enter a valid date of birth');
      return false;
    }
    if (age < 13) {
      setError('You must be at least 13 years old to register');
      return false;
    }

    // Phone validation (basic)
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      setError('Please enter a valid phone number (10-15 digits)');
      return false;
    }

    return true;
  };

  const handleSignup = async (confirmDuplicateUsername = false) => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/signup`, {
        username: username.trim(),
        email: email.trim(),
        password: password.trim(),
        dateOfBirth: convertDateForBackend(dateOfBirth.trim()),
        phone: phone.replace(/\s/g, ''),
        points: 0,
        confirmDuplicateUsername
      });

      if (response.data.success) {
        Alert.alert(
          'Success',
          'Account created successfully! Please login.',
          [{ text: 'OK', onPress: () => router.push('./LoginScreen') }]
        );
      } else {
        setError(response.data.message || 'Signup failed');
      }
    } catch (err: any) {
      if (err.response && err.response.status === 409 && err.response.data.type === 'username_exists') {
        // Username already exists - show confirmation dialog
        Alert.alert(
          'Username Already Exists',
          `The username "${username}" is already taken. Are you sure you want to use this username? Other users will have the same username.`,
          [
            {
              text: 'Choose Different Username',
              style: 'cancel',
              onPress: () => setIsLoading(false)
            },
            {
              text: 'Yes, Use This Username',
              onPress: () => handleSignup(true) // Retry with confirmation
            }
          ]
        );
        return; // Don't set isLoading to false here, it will be handled in the alert actions
      } else if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Network error. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToLogin = () => {
    router.push('./LoginScreen');
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join our recipe community today</Text>
      </View>

      {/* Form Section */}
      <View style={styles.formContainer}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Choose a username"
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              if (error) setError('');
            }}
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError('');
            }}
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Create a password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (error) setError('');
            }}
            placeholderTextColor="#999"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (error) setError('');
            }}
            placeholderTextColor="#999"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Date of Birth</Text>
          <TextInput
            style={styles.input}
            placeholder="DD-MM-YYYY"
            value={dateOfBirth}
            onChangeText={handleDateChange}
            placeholderTextColor="#999"
            keyboardType="numeric"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
          />
          <Text style={styles.helperText}>Example: 08-02-2004 (just type: 08022004)</Text>
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your phone number"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (error) setError('');
            }}
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            autoCorrect={false}
          />
        </View>
        
        <TouchableOpacity 
          style={[styles.signupButton, isLoading && styles.buttonDisabled]} 
          onPress={() => handleSignup()}
          disabled={isLoading}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.buttonText}>Creating Account...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>
        
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>
        
        <TouchableOpacity style={styles.loginButton} onPress={navigateToLogin}>
          <Text style={styles.loginButtonText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
    opacity: 0.7,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#f8f8f8',
  },
  signupButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#ff8c00',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#333333',
    opacity: 0.7,
  },
  loginButton: {
    borderWidth: 2,
    borderColor: '#ff8c00',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#ff8c00',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '500',
  },
  helperText: {
    color: '#333333',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    opacity: 0.6,
  },
});
