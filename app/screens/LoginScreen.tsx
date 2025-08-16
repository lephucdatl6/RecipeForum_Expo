import axios from 'axios';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity
} from 'react-native';
import { API_BASE_URL } from '../../config/apiConfig';

const API_URL = `${API_BASE_URL}/api/auth`;

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setError('');

    // Validation
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    console.log('Login attempt:', { username: username.trim(), API_URL });
    
    try {
      console.log('Making login request to:', `${API_URL}/login`);
      const axiosConfig = {
        timeout: 10000, // 10 seconds timeout
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        // Add retry logic for network issues
        validateStatus: function (status: number) {
          return status < 500; // Accept all responses below 500
        }
      };
      
      const response = await axios.post(`${API_URL}/login`, {
        username: username.trim(),
        password: password.trim(),
      }, axiosConfig);

      console.log('Login response:', response.data);

      if (response.data.success) {
        console.log('Login successful, navigating to RecipesForumScreen');
        // Store user data and navigate to forum screen
        router.replace({
          pathname: './RecipesForumScreen',
          params: { userData: JSON.stringify(response.data.user) }
        });
      } else {
        console.log('Login failed:', response.data.message);
        setError(response.data.message || 'Login failed');
      }
    } catch (err: any) {
      console.error('Login error details:', err);
      console.error('Error name:', err.name);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        setError('Connection timeout. Please check your network and try again.');
      } else if (err.code === 'ECONNREFUSED') {
        setError('Cannot connect to server. Please make sure the backend is running.');
      } else if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
        setError('Network error. Please check your internet connection.');
      } else if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else if (err.message) {
        setError(`Connection error: ${err.message}`);
      } else {
        setError('Network error. Please check your connection and backend server.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToSignup = () => {
    router.push('./SignupScreen');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Login</Text>
        
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        
        <TextInput
          style={[styles.input, error && username === '' ? styles.inputError : null]}
          placeholder="Username"
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            if (error && text.trim()) setError('');
          }}
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <TextInput
          style={[styles.input, error && password === '' ? styles.inputError : null]}
          placeholder="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (error && text.trim()) setError('');
          }}
          placeholderTextColor="#aaa"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Logging in...' : 'Login'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.linkButton} onPress={navigateToSignup}>
          <Text style={styles.linkText}>Don't have an account? Sign up</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
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
  inputError: {
    borderColor: '#ff4444',
    borderWidth: 2,
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
});