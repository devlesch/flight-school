import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ConnectionStatusProps {
  onRetry?: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ onRetry }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      // Simple health check - try to get session
      const { error } = await supabase.auth.getSession();
      setIsOffline(!!error);
      if (!error) {
        setDismissed(false);
      }
    } catch {
      setIsOffline(true);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Check connection on mount
    checkConnection();

    // Check connection periodically (every 30 seconds)
    const interval = setInterval(checkConnection, 30000);

    // Listen for online/offline events
    const handleOnline = () => {
      checkConnection();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    checkConnection();
    onRetry?.();
  };

  if (!isOffline || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-[#013E3F] px-4 py-2 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5" />
          <span className="font-medium text-sm">
            Unable to connect to the server. Some features may be unavailable.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="bg-[#013E3F] text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wide hover:bg-[#013E3F]/80 disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            Retry
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-amber-600 rounded"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatus;
