import React, { useEffect } from 'react';
import AppRoot from './src/AppRoot';
import { colors } from './src/theme/tokens';

const SCROLLBAR_CSS = `
  * {
    scrollbar-width: thin;
    scrollbar-color: ${colors.border} transparent;
  }
  *::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  *::-webkit-scrollbar-track {
    background: transparent;
  }
  *::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 999px;
  }
  *::-webkit-scrollbar-thumb:hover {
    background: ${colors.textSecondary};
  }
`;

export default function AppWeb() {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = SCROLLBAR_CSS;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return <AppRoot />;
}
