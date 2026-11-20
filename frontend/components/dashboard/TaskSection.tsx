import { View, Text, StyleSheet } from 'react-native';

type Props = {
  title: string;
  children?: React.ReactNode;
};

export function TaskSection({ title, children }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.content}>
        {children || <Text style={styles.empty}>Nenhuma tarefa encontrada.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#124559',
    marginBottom: 10,
    textTransform: 'lowercase',
  },
  content: {
    gap: 10,
  },
  empty: {
    color: '#8899a3',
    fontStyle: 'italic',
  }
});
