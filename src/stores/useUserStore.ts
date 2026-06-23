import { create } from 'zustand';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import type { UserProfile } from '../context/AuthContext';

interface UserStoreState {
  users: UserProfile[];
  loading: boolean;
  initialized: boolean;
  initialize: () => () => void;
  addUser: (userData: Omit<UserProfile, 'uid'> & { password?: string }) => Promise<string>;
  updateUserPermissions: (uid: string, permissions: UserProfile['permissions']) => Promise<void>;
  updateUserRole: (uid: string, role: UserProfile['role']) => Promise<void>;
  updateUser: (uid: string, userData: Partial<UserProfile>) => Promise<void>;
}

const STORAGE_KEY = 'northstar_mock_users';
const DEFAULT_MOCK_USERS: UserProfile[] = [
  {
    uid: 'admin-uid',
    email: 'admin@northstar.com',
    displayName: 'Admin User',
    role: 'admin',
    monthly_meeting_quota: 20,
    permissions: {
      canManageDeals: true,
      canManageMeetings: true,
      canManageCadences: true,
      canViewAllSchedules: true,
    }
  },
  {
    uid: 'sales-uid',
    email: 'sales@northstar.com',
    displayName: 'John Salesperson',
    role: 'salesperson',
    monthly_meeting_quota: 20,
    permissions: {
      canManageDeals: true,
      canManageMeetings: true,
      canManageCadences: false,
      canViewAllSchedules: false,
    }
  }
];

export const useUserStore = create<UserStoreState>((set, get) => ({
  users: [],
  loading: true,
  initialized: false,

  initialize: () => {
    if (get().initialized) return () => {};

    if (isFirebaseConfigured && db) {
      const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
        const userList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            uid: docSnap.id,
            ...data,
          } as UserProfile;
        });
        set({ users: userList, loading: false, initialized: true });
      }, (err) => {
        console.error('Error listening to users:', err);
        set({ loading: false });
      });
      return unsubscribe;
    } else {
      const loadLocal = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          set({ users: JSON.parse(stored), loading: false, initialized: true });
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_USERS));
          set({ users: DEFAULT_MOCK_USERS, loading: false, initialized: true });
        }
      };

      loadLocal();

      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) {
          loadLocal();
        }
      };
      window.addEventListener('storage', handleStorageChange);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  },

  addUser: async (userData) => {
    const defaultPermissions = {
      canManageDeals: userData.role === 'admin',
      canManageMeetings: true,
      canManageCadences: userData.role === 'admin',
      canViewAllSchedules: userData.role === 'admin',
    };

    const finalPermissions = userData.permissions || defaultPermissions;
    const quota = userData.monthly_meeting_quota !== undefined ? userData.monthly_meeting_quota : 20;

    if (isFirebaseConfigured && db) {
      // In firebase context, creating auth users usually needs admin auth, 
      // so we write the profile directly to firestore (simulate admin creation).
      const newUid = `user-${Date.now()}`;
      await setDoc(doc(db, 'users', newUid), {
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        monthly_meeting_quota: quota,
        permissions: finalPermissions,
        createdAt: new Date(),
      });
      return newUid;
    } else {
      const uid = `mock-uid-${Date.now()}`;
      const newUser: UserProfile = {
        uid,
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        monthly_meeting_quota: quota,
        permissions: finalPermissions,
      };
      const list = [...get().users, newUser];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ users: list });
      return uid;
    }
  },

  updateUserPermissions: async (uid, permissions) => {
    if (isFirebaseConfigured && db) {
      const docRef = doc(db, 'users', uid);
      await updateDoc(docRef, {
        permissions,
        updatedAt: new Date(),
      });
    } else {
      const list = get().users.map((u) => {
        if (u.uid === uid) {
          return {
            ...u,
            permissions: {
              ...u.permissions,
              ...permissions,
            },
          };
        }
        return u;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ users: list });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('northstar-user-updated'));
      }
    }
  },

  updateUserRole: async (uid, role) => {
    if (isFirebaseConfigured && db) {
      const docRef = doc(db, 'users', uid);
      await updateDoc(docRef, {
        role,
        updatedAt: new Date(),
      });
    } else {
      const list = get().users.map((u) => {
        if (u.uid === uid) {
          const defaultPermissions = {
            canManageDeals: role === 'admin',
            canManageMeetings: true,
            canManageCadences: role === 'admin',
            canViewAllSchedules: role === 'admin',
          };
          return {
            ...u,
            role,
            permissions: defaultPermissions,
          };
        }
        return u;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ users: list });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('northstar-user-updated'));
      }
    }
  },

  updateUser: async (uid, userData) => {
    if (isFirebaseConfigured && db) {
      const docRef = doc(db, 'users', uid);
      await updateDoc(docRef, {
        ...userData,
        updatedAt: new Date(),
      });
    } else {
      const list = get().users.map((u) => {
        if (u.uid === uid) {
          return {
            ...u,
            ...userData,
          };
        }
        return u;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ users: list });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('northstar-user-updated'));
      }
    }
  },
}));
