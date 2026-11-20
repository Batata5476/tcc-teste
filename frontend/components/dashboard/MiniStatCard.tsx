import { View, Text } from 'react-native';

type Props = {
  title: string;
  value: string;
};

export function MiniStatCard({ title, value }: Props) {
  return (
    <View
      style={{
        backgroundColor: '#EFEBDD',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 14,
        minWidth: 85,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: '#5B5B5B',
          marginBottom: 4,
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          fontSize: 20,
          fontWeight: '700',
          color: '#124559',
        }}
      >
        {value}
      </Text>
    </View>
  );
}
