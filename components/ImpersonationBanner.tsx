import React from 'react';
import type { User } from '../types';
import { Eye, X } from 'lucide-react';

interface ImpersonationBannerProps {
  impersonatedUser: User;
  onExit: () => void;
}

const ImpersonationBanner: React.FC<ImpersonationBannerProps> = ({ impersonatedUser, onExit }) => {
  return (
    <div
      data-testid="impersonation-banner"
      className="bg-[#FDD344] text-[#013E3F] px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">
          Viewing as <strong>{impersonatedUser.name}</strong> ({impersonatedUser.role}) — UI preview only
        </span>
      </div>
      <button
        onClick={onExit}
        aria-label="Exit impersonation"
        className="flex items-center gap-1 px-3 py-1 rounded bg-[#013E3F]/10 hover:bg-[#013E3F]/20 transition-colors text-xs font-bold uppercase tracking-wide flex-shrink-0"
      >
        <X className="w-3 h-3" /> Exit
      </button>
    </div>
  );
};

export default ImpersonationBanner;
