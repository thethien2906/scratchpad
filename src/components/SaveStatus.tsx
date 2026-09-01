import React from 'react';
import { SaveStatusState } from '../types';
import { Loader2, AlertCircle } from 'lucide-react';

interface SaveStatusProps {
  status: SaveStatusState;
}

export const SaveStatus: React.FC<SaveStatusProps> = ({ status }) => {
  if (status === 'saved' || status === 'unsaved') {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs select-none transition-opacity duration-200">
      {status === 'saving' && (
        <span className="flex items-center gap-1 text-text-secondary animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Saving...</span>
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1 text-red-400">
          <AlertCircle className="w-3 h-3" />
          <span>Error saving</span>
        </span>
      )}
    </div>
  );
};
