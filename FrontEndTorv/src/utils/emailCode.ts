export const CODE_LENGTH = 6;

export const sanitizeCode = (text: string): string => text.replace(/\D/g, '').slice(0, CODE_LENGTH);
export const isCodeComplete = (code: string): boolean => /^\d{6}$/.test(code);
