import React from 'react';
import { Modal, View, Text } from 'react-native';
import { Dumbbell, Stethoscope, Pencil } from 'lucide-react-native';
import { Button } from '../Button';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

// Mostrada uma vez por conta, no 1º acesso (GET /profile → welcome_pending).
interface Props {
  visible: boolean;
  name?: string;
  onClose: () => void;
}

const POINTS = [
  {
    Icon: Dumbbell,
    text: 'Com os dados do seu cadastro, montamos um plano de treinos e metas de calorias e macronutrientes iniciais. Eles são genéricos.',
  },
  {
    Icon: Stethoscope,
    text: 'O ideal é ter o acompanhamento de um profissional (educador físico e nutricionista). Em breve isso estará aqui no app.',
  },
  {
    Icon: Pencil,
    text: 'Fique à vontade para editar seus treinos e suas metas quando quiser.',
  },
];

export const WelcomeModal: React.FC<Props> = ({ visible, name, onClose }) => {
  const firstName = name?.trim().split(/\s+/)[0];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content} accessibilityRole="alert">
          <Text style={styles.title}>{firstName ? `Bem-vindo(a) ao Torv, ${firstName}!` : 'Bem-vindo(a) ao Torv!'}</Text>
          {POINTS.map(({ Icon, text }) => (
            <View key={text} style={styles.point}>
              <View style={styles.pointIcon}>
                <Icon color={colors.brand} size={18} />
              </View>
              <Text style={styles.pointText}>{text}</Text>
            </View>
          ))}
          <Button title="Começar" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
};
