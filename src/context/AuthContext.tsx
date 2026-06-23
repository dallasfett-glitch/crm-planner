import { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fbSignOut
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'salesperson';
  monthly_meeting_quota?: number;
  permissions?: {
    canManageDeals?: boolean;
    canManageMeetings?: boolean;
    canManageCadences?: boolean;
    canViewAllSchedules?: boolean;
  };
  createdAt?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, role: 'admin' | 'salesperson') => Promise<void>;
  signOut: () => Promise<void>;
  isMockMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default mock users for testing when Firebase is not configured
const MOCK_USERS_KEY = 'northstar_mock_users';
const CURRENT_MOCK_USER_KEY = 'northstar_current_mock_user';

const defaultMockUsers: UserProfile[] = [
  {
    uid: 'admin-uid',
    email: 'admin@northstar.com',
    displayName: 'Admin User',
    role: 'admin',
    monthly_meeting_quota: 20,
  },
  {
    uid: 'sales-uid',
    email: 'sales@northstar.com',
    displayName: 'John Salesperson',
    role: 'salesperson',
    monthly_meeting_quota: 20,
  }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize mock users in localStorage if they don't exist
  useEffect(() => {
    if (!localStorage.getItem(MOCK_USERS_KEY)) {
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(defaultMockUsers));
    }
  }, []);

  useEffect(() => {
    if (isFirebaseConfigured && auth && db) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        try {
          if (firebaseUser) {
            // Get user profile from Firestore
            const userRef = doc(db!, 'users', firebaseUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                ...(userSnap.data() as Omit<UserProfile, 'uid' | 'email'>),
              });
            } else {
              // Create user profile if missing
              const profile: Omit<UserProfile, 'uid'> = {
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                role: 'salesperson',
              };
              await setDoc(userRef, {
                ...profile,
                createdAt: serverTimestamp(),
              });
              setUser({ uid: firebaseUser.uid, ...profile });
            }
          } else {
            setUser(null);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setUser(null);
        } finally {
          setLoading(false);
        }
      });

      return () => unsubscribe();
    } else {
      // Local Storage Mock Authentication Flow
      const syncUser = () => {
        const storedUser = localStorage.getItem(CURRENT_MOCK_USER_KEY);
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            const mockUsers = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
            const latest = mockUsers.find((u: UserProfile) => u.uid === parsed.uid);
            if (latest) {
              setUser(latest);
              localStorage.setItem(CURRENT_MOCK_USER_KEY, JSON.stringify(latest));
            } else {
              setUser(parsed);
            }
          } catch (err) {
            console.error('Failed to parse mock user storage:', err);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      };

      syncUser();

      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === MOCK_USERS_KEY || e.key === CURRENT_MOCK_USER_KEY) {
          syncUser();
        }
      };

      const handleCustomUpdate = () => {
        syncUser();
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('northstar-user-updated', handleCustomUpdate);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('northstar-user-updated', handleCustomUpdate);
      };
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    if (isFirebaseConfigured && auth) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      // Mock Sign In
      const mockUsers: UserProfile[] = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
      const foundUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      // Simple mock validation (any password matches for mock accounts)
      if (foundUser) {
        localStorage.setItem(CURRENT_MOCK_USER_KEY, JSON.stringify(foundUser));
        setUser(foundUser);
      } else {
        throw new Error('User not found. Try admin@northstar.com or sales@northstar.com (any password).');
      }
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    role: 'admin' | 'salesperson'
  ) => {
    if (isFirebaseConfigured && auth && db) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const profile: Omit<UserProfile, 'uid'> = {
        email,
        displayName,
        role,
      };
      await setDoc(doc(db!, 'users', userCredential.user.uid), {
        ...profile,
        createdAt: serverTimestamp(),
      });
      setUser({ uid: userCredential.user.uid, ...profile });
    } else {
      // Mock Sign Up
      const mockUsers: UserProfile[] = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
      if (mockUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('Email is already registered.');
      }
      const newMockUser: UserProfile = {
        uid: `mock-uid-${Date.now()}`,
        email,
        displayName,
        role,
      };
      mockUsers.push(newMockUser);
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(mockUsers));
      localStorage.setItem(CURRENT_MOCK_USER_KEY, JSON.stringify(newMockUser));
      setUser(newMockUser);
    }
  };

  const signOut = async () => {
    if (isFirebaseConfigured && auth) {
      await fbSignOut(auth);
    } else {
      localStorage.removeItem(CURRENT_MOCK_USER_KEY);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, isMockMode: !isFirebaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
