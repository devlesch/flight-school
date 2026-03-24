import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Profile } from '../types/database';
import { getAllProfiles } from '../services/teamService';
import { Eye, Search, Loader2, AlertCircle } from 'lucide-react';

interface ImpersonationPickerProps {
  onSelectUser: (profile: Profile) => void;
  isAdmin: boolean;
  isImpersonating: boolean;
}

const ImpersonationPicker: React.FC<ImpersonationPickerProps> = ({ onSelectUser, isAdmin, isImpersonating }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllProfiles();
      setProfiles(data);
      setHasFetched(true);
    } catch {
      setError('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Reset state when hidden
  useEffect(() => {
    if (!isAdmin || isImpersonating) {
      setIsOpen(false);
      setSearch('');
    }
  }, [isAdmin, isImpersonating]);

  if (!isAdmin || isImpersonating) return null;

  const handleOpen = () => {
    setIsOpen(true);
    if (!hasFetched) {
      fetchProfiles();
    }
  };

  const handleSelect = (profile: Profile) => {
    onSelectUser(profile);
    setIsOpen(false);
    setSearch('');
  };

  const filtered = profiles.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="w-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-[#F3EEE7]/50 hover:text-[#FDD344] py-2 rounded transition-colors group"
      >
        <Eye className="w-3 h-3 group-hover:text-[#FDD344]" /> View as...
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#012d2e] border border-[#F3EEE7]/10 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="p-2 border-b border-[#F3EEE7]/10">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#F3EEE7]/40" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full pl-7 pr-2 py-1.5 bg-[#013E3F] border border-[#F3EEE7]/10 rounded text-xs text-[#F3EEE7] placeholder-[#F3EEE7]/30 focus:outline-none focus:border-[#FDD344]/50"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-4 text-[#F3EEE7]/40 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading profiles...
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center gap-2 py-4 text-xs">
                <div className="flex items-center gap-1 text-red-400">
                  <AlertCircle className="w-3 h-3" /> {error}
                </div>
                <button
                  onClick={fetchProfiles}
                  className="text-[#FDD344] hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="py-4 text-center text-[#F3EEE7]/30 text-xs">
                {search ? 'No matching users' : 'No users found'}
              </div>
            )}

            {!loading && !error && filtered.map(profile => (
              <button
                key={profile.id}
                onClick={() => handleSelect(profile)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#F3EEE7]/5 transition-colors text-left"
              >
                <img
                  src={profile.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'}
                  alt=""
                  className="w-6 h-6 rounded-full flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#F3EEE7] truncate">{profile.name}</p>
                  <p className="text-[10px] text-[#F3EEE7]/40 uppercase tracking-wide">{profile.role}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImpersonationPicker;
