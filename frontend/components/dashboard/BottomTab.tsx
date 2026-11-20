import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export function BottomTab() {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.tabItem}>
        <Text style={styles.tabText}>Início</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tabItem}>
        <Text style={styles.tabText}>Tarefas</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tabItem}>
        <Text style={styles.tabText}>Perfil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    justifyContent: 'space-around',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    color: '#124559',
  },
});
