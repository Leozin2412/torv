import React from 'react';
import { Modal, View, Text } from 'react-native';
import { Button } from '../Button';
import { styles } from './styles';

// Confirmação própria: Alert.alert não funciona no react-native-web.
interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<Props> = ({ visible, title, message, confirmLabel, danger, loading, onConfirm, onCancel }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.overlay}>
      <View style={styles.content} accessibilityRole="alert">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Button title={confirmLabel} danger={danger} loading={loading} onPress={onConfirm} />
        <Button title="Cancelar" outline onPress={onCancel} disabled={loading} />
      </View>
    </View>
  </Modal>
);
