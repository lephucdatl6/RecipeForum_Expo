import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Button, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { API_BASE_URL } from '../apiConfig';

const API_URL = `${API_BASE_URL}/api/users`;

export default function UserScreen() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const fetchUsers = async () => {
    const res = await axios.get(API_URL);
    setUsers(res.data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const addUser = async () => {
    if (!username || !email) return;
    await axios.post(API_URL, { username, email });
    setUsername('');
    setEmail('');
    fetchUsers();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Users</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        placeholderTextColor="#aaa"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        placeholderTextColor="#aaa"
      />
      <Button title="Add User" onPress={addUser} />

      <FlatList
        data={users}
        keyExtractor={item => item.user_id?.toString()}
        renderItem={({ item }) => (
          <Text style={styles.userText}>{item.username} - {item.email}</Text>
        )}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: 'black',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginVertical: 6,
    borderRadius: 4,
    color: 'black',
  },
  list: {
    marginTop: 20,
  },
  userText: {
    color: 'black',
    marginVertical: 4,
  },
});
