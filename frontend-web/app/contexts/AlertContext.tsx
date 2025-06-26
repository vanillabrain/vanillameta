'use client';

import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { X } from 'lucide-react';

interface AlertMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
}

interface AlertContextType {
  alerts: AlertMessage[];
  addAlert: (alert: Omit<AlertMessage, 'id'>) => void;
  removeAlert: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

interface AlertProviderProps {
  children: ReactNode;
}

export const AlertProvider = ({ children }: AlertProviderProps) => {
  const [alerts, setAlerts] = useState<AlertMessage[]>([]);

  const addAlert = useCallback((alert: Omit<AlertMessage, 'id'>) => {
    const id = Date.now().toString();
    const newAlert = { ...alert, id };
    
    setAlerts(prev => [...prev, newAlert]);
    
    // 자동 제거 (5초 후)
    setTimeout(() => {
      removeAlert(id);
    }, 5000);
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  const success = useCallback((message: string, title?: string) => {
    addAlert({ type: 'success', message, title });
  }, [addAlert]);

  const error = useCallback((message: string, title?: string) => {
    addAlert({ type: 'error', message, title });
  }, [addAlert]);

  const warning = useCallback((message: string, title?: string) => {
    addAlert({ type: 'warning', message, title });
  }, [addAlert]);

  const info = useCallback((message: string, title?: string) => {
    addAlert({ type: 'info', message, title });
  }, [addAlert]);

  const value: AlertContextType = {
    alerts,
    addAlert,
    removeAlert,
    success,
    error,
    warning,
    info,
  };

  return (
    <AlertContext.Provider value={value}>
      {children}
      
      {/* Alert Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {alerts.map((alert) => (
          <Alert
            key={alert.id}
            variant={alert.type === 'error' ? 'destructive' : 'default'}
            className="shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {alert.title && (
                  <h4 className="font-semibold text-sm">{alert.title}</h4>
                )}
                <p className="text-sm">{alert.message}</p>
              </div>
              <button
                onClick={() => removeAlert(alert.id)}
                className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Alert>
        ))}
      </div>
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
};

// Backward compatibility
export { AlertContext };