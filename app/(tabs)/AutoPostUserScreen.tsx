import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL } from '../apiConfig';

const API_URL = `${API_BASE_URL}/api/users`;

function getRandomName() {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Heidi'];
  return names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 1000);
}

function getRandomEmail(name: string) {
  return `${name.toLowerCase()}@example.com`;
}

export default function AutoPostUserScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    const res = await axios.get(API_URL);
    setUsers(res.data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const postRandomUser = async () => {
    setLoading(true);
    const name = getRandomName();
    const email = getRandomEmail(name);
    await axios.post(API_URL, { username: name, email });
    await fetchUsers();
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Button title={loading ? 'Posting...' : 'Post Random User'} onPress={postRandomUser} disabled={loading} />
      <FlatList
        data={users}
        keyExtractor={item => item.user_id}
        renderItem={({ item }) => (
          <Text style={styles.userItem}>{item.username} - {item.email}</Text>
        )}
        style={{ marginTop: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff', justifyContent: 'center' },
  userItem: { fontSize: 16, marginVertical: 4 },
});
