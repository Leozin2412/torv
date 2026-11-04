import { File } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';

// Celular: o picker copia o arquivo para o cache (copyToCacheDirectory) e o expo-file-system lê de lá.
export const readPickedFile = (asset: DocumentPickerAsset): Promise<string> => new File(asset.uri).text();
