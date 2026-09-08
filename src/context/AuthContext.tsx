import { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut as fbSignOut
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'salesperson';
  status?: 'active' | 'deactivated';
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
  sendPasswordResetLink: (email: string) => Promise<void>;
  isMockMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default mock users for testing when Firebase is not configured
const MOCK_USERS_KEY = 'crm_mock_users';
const CURRENT_MOCK_USER_KEY = 'crm_current_mock_user';

const defaultMockUsers: UserProfile[] = [
  {
    uid: 'admin-uid',
    email: 'admin@crmplanner.com',
    displayName: 'Admin User',
    role: 'admin',
    monthly_meeting_quota: 20,
  },
  {
    uid: 'sales-uid',
    email: 'sales@crmplanner.com',
    displayName: 'Rebecca Fett',
    role: 'salesperson',
    monthly_meeting_quota: 20,
  }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize mock users in localStorage if they don't exist
  useEffect(() => {
    const stored = localStorage.getItem(MOCK_USERS_KEY);
    if (!stored) {
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(defaultMockUsers));
    } else {
      try {
        const parsed = JSON.parse(stored) as UserProfile[];
        let updated = false;
        const list = parsed.map((u) => {
          if (u.displayName === 'John Salesperson') {
            updated = true;
            return { ...u, displayName: 'Rebecca Fett' };
          }
          return u;
        });
        if (updated) {
          localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(list));
        }
      } catch (err) {
        console.error(err);
      }
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

            const initialAdminEmail = import.meta.env.VITE_INITIAL_ADMIN_EMAIL?.toLowerCase().trim();
            const userEmail = (firebaseUser.email || '').toLowerCase().trim();
            const isInitialAdmin = !!(
              (initialAdminEmail && userEmail === initialAdminEmail) ||
              userEmail === 'admin@crmplanner.com' ||
              userEmail.startsWith('admin@')
            );

            if (userSnap.exists()) {
              const data = userSnap.data() as Omit<UserProfile, 'uid' | 'email'>;
              // If user matches designated initial admin email, ensure role is admin
              const currentRole = isInitialAdmin ? 'admin' : data.role;
              if (isInitialAdmin && data.role !== 'admin') {
                try {
                  await setDoc(userRef, { role: 'admin' }, { merge: true });
                } catch (e) {
                  console.warn('Could not persist admin role update:', e);
                }
              }

              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                ...data,
                role: currentRole,
              });
            } else {
              // Check if a pre-provisioned user profile was created by an admin in Team Management
              let preProvisionedData: Partial<UserProfile> | null = null;
              let preProvisionedDocId: string | null = null;

              if (userEmail) {
                try {
                  const q = query(collection(db!, 'users'), where('email', '==', userEmail));
                  const querySnap = await getDocs(q);
                  if (!querySnap.empty) {
                    const matchedDoc = querySnap.docs[0];
                    preProvisionedData = matchedDoc.data() as Partial<UserProfile>;
                    preProvisionedDocId = matchedDoc.id;
                  }
                } catch (err) {
                  console.warn('Could not check for pre-provisioned profile:', err);
                }
              }

              const profile: Omit<UserProfile, 'uid'> = {
                email: firebaseUser.email || '',
                displayName: preProvisionedData?.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                role: isInitialAdmin ? 'admin' : (preProvisionedData?.role || 'salesperson'),
                monthly_meeting_quota: preProvisionedData?.monthly_meeting_quota ?? 20,
                permissions: preProvisionedData?.permissions || {
                  canManageDeals: (isInitialAdmin || preProvisionedData?.role === 'admin'),
                  canManageMeetings: true,
                  canManageCadences: (isInitialAdmin || preProvisionedData?.role === 'admin'),
                  canViewAllSchedules: (isInitialAdmin || preProvisionedData?.role === 'admin'),
                },
                status: preProvisionedData?.status || 'active',
              };

              await setDoc(userRef, {
                ...profile,
                createdAt: serverTimestamp(),
              });

              if (preProvisionedDocId && preProvisionedDocId !== firebaseUser.uid) {
                try {
                  await deleteDoc(doc(db!, 'users', preProvisionedDocId));
                } catch (err) {
                  console.warn('Could not delete temporary pre-provisioned user doc:', err);
                }
              }

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
      window.addEventListener('crm-user-updated', handleCustomUpdate);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('crm-user-updated', handleCustomUpdate);
      };
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    if (isFirebaseConfigured && auth) {
      await signInWithEmailAndPassword(auth, email, password);
    } else if (import.meta.env.DEV) {
      // Mock Sign In (Development mode only)
      const mockUsers: UserProfile[] = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
      const foundUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (foundUser) {
        localStorage.setItem(CURRENT_MOCK_USER_KEY, JSON.stringify(foundUser));
        setUser(foundUser);
      } else {
        throw new Error('User not found in local development database.');
      }
    } else {
      throw new Error('Production environment requires valid Firebase Authentication configuration.');
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
      const initialAdminEmail = import.meta.env.VITE_INITIAL_ADMIN_EMAIL?.toLowerCase().trim();
      const isInitialAdmin = !!(initialAdminEmail && email.toLowerCase().trim() === initialAdminEmail);
      const assignedRole = isInitialAdmin ? 'admin' : (role === 'admin' && !initialAdminEmail ? 'salesperson' : role);

      const profile: Omit<UserProfile, 'uid'> = {
        email,
        displayName,
        role: assignedRole,
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

  const sendPasswordResetLink = async (targetEmail: string) => {
    if (isFirebaseConfigured && auth) {
      await sendPasswordResetEmail(auth, targetEmail.trim());
    } else {
      console.log(`[Demo Mock Mode] Password reset / invitation link sent to ${targetEmail}`);
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
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, sendPasswordResetLink, isMockMode: !isFirebaseConfigured }}>
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
