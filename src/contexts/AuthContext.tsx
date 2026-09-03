import { createContext, useContext } from 'react';
import type { UserProfile } from '../types';

export interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  simulatedRole: 'admin' | 'student';
  setSimulatedRole: (role: 'admin' | 'student') => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  simulatedRole: 'admin',
  setSimulatedRole: () => {}
});

export const useAuth = () => useContext(AuthContext);
