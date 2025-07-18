import axios from 'axios';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
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
    // Remove all non-numeric characters
    const numbers = text.replace(/\D/g, '');
    
    // If user is deleting (current length < previous length), handle it properly
    if (text.length < previousText.length) {
      // If the user deleted a dash, remove the number before it too
      if (previousText.endsWith('-') && !text.endsWith('-')) {
        const numbersFromPrev = previousText.replace(/\D/g, '');
        const newNumbers = numbersFromPrev.slice(0, -1);
        return formatDateInput(newNumbers);
      }
      // Otherwise just format the remaining numbers
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
    // Convert DD-MM-YYYY to YYYY-MM-DD for backend
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

    // Validate date is reasonable (not in future, not too old)
    const [day, month, year] = dateOfBirth.split('-').map(Number);
    const birthDate = new Date(year, month - 1, day); // month is 0-indexed in JS Date
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

  const handleSignup = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/signup`, {
        username: username.trim(),
        email: email.trim(),
        password: password.trim(),
        dateOfBirth: convertDateForBackend(dateOfBirth.trim()),
        phone: phone.replace(/\s/g, ''), // Remove spaces
        points: 0 // Default points
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
      if (err.response && err.response.data && err.response.data.message) {
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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Sign Up</Text>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={(text) => {
          setUsername(text);
          if (error) setError('');
        }}
        placeholderTextColor="#aaa"
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (error) setError('');
        }}
        placeholderTextColor="#aaa"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (error) setError('');
        }}
        placeholderTextColor="#aaa"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={(text) => {
          setConfirmPassword(text);
          if (error) setError('');
        }}
        placeholderTextColor="#aaa"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Date of Birth (DD-MM-YYYY)"
        value={dateOfBirth}
        onChangeText={handleDateChange}
        placeholderTextColor="#aaa"
        keyboardType="numeric"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={10}
      />
      <Text style={styles.helperText}>Example: 08-02-2004 (just type: 08022004)</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        value={phone}
        onChangeText={(text) => {
          setPhone(text);
          if (error) setError('');
        }}
        placeholderTextColor="#aaa"
        keyboardType="phone-pad"
        autoCorrect={false}
      />
      
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]} 
        onPress={handleSignup}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Creating Account...' : 'Sign Up'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.linkButton} onPress={navigateToLogin}>
        <Text style={styles.linkText}>Already have an account? Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    marginVertical: 8,
    borderRadius: 8,
    color: 'black',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
    marginBottom: 40,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 16,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
    backgroundColor: '#ffe6e6',
    padding: 10,
    borderRadius: 5,
  },
  helperText: {
    color: '#666',
    fontSize: 12,
    marginTop: -5,
    marginBottom: 10,
    fontStyle: 'italic',
  },
});
