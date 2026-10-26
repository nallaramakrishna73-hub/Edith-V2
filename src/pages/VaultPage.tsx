import React from 'react';
import { FileVault } from '../components/FileVault.tsx';

export const VaultPage: React.FC = () => {
  return (
    <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-4 h-[calc(100vh-4.2rem)]">
      <FileVault />
    </div>
  );
};
