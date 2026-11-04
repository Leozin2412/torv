import type { DocumentPickerAsset } from 'expo-document-picker';

// Web: o picker devolve o File do navegador; o expo-file-system não roda no web.
export async function readPickedFile(asset: DocumentPickerAsset): Promise<string> {
  if (asset.file) return asset.file.text();
  return (await fetch(asset.uri)).text();
}
