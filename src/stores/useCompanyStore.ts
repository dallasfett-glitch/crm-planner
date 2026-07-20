import { create } from 'zustand';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';

export interface Company {
  id: string;
  name: string;
  domain: string;
  industry: string;
  phone: string;
  street: string;
  suburb: string;
  state: string;
  country: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  assignedSalespersonId: string;
  tier: 'A' | 'B' | 'C'; // Tier classification for Companies
  primaryOwner: string; // Mandatory Primary Owner for accountability
  createdAt: string;
  updatedAt: string;
}

interface CompanyState {
  companies: Company[];
  loading: boolean;
  initialized: boolean;
  initialize: () => () => void;
  addCompany: (company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateCompany: (id: string, updates: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
}

const STORAGE_KEY = 'CRM Planner_companies';
const SEED_COMPANIES: Company[] = [
  {
    id: 'comp-1',
    name: 'Tesla',
    domain: 'tesla.com',
    industry: 'Automotive',
    phone: '1-800-555-0199',
    street: '1 Tesla Road',
    suburb: 'Austin',
    state: 'Texas',
    country: 'USA',
    assignedSalespersonId: 'sales-uid',
    tier: 'A',
    primaryOwner: 'John Salesperson',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'comp-2',
    name: 'SpaceX',
    domain: 'spacex.com',
    industry: 'Aerospace',
    phone: '1-800-555-0200',
    street: '1 Rocket Road',
    suburb: 'Hawthorne',
    state: 'California',
    country: 'USA',
    assignedSalespersonId: 'sales-uid',
    tier: 'A',
    primaryOwner: 'John Salesperson',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'comp-3',
    name: 'Acme Corp',
    domain: 'acme.com',
    industry: 'Manufacturing',
    phone: '1-800-555-0300',
    street: '123 Desert Road',
    suburb: 'Roadrunner Valley',
    state: 'Arizona',
    country: 'USA',
    assignedSalespersonId: 'admin-uid',
    tier: 'C',
    primaryOwner: 'Admin User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'comp-4',
    name: 'Google',
    domain: 'google.com',
    industry: 'Technology',
    phone: '1-800-555-0400',
    street: '1600 Amphitheatre Pkwy',
    suburb: 'Mountain View',
    state: 'California',
    country: 'USA',
    assignedSalespersonId: 'sales-uid',
    tier: 'B',
    primaryOwner: 'John Salesperson',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: [],
  loading: true,
  initialized: false,

  initialize: () => {
    if (get().initialized) return () => {};

    if (isFirebaseConfigured && db) {
      const q = query(collection(db, 'companies'), orderBy('name', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const companyList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          } as Company;
        });
        set({ companies: companyList, loading: false, initialized: true });
      }, (err) => {
        console.error('Error listening to companies:', err);
        set({ loading: false });
      });
      return unsubscribe;
    } else {
      const loadLocal = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          set({ companies: JSON.parse(stored), loading: false, initialized: true });
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_COMPANIES));
          set({ companies: SEED_COMPANIES, loading: false, initialized: true });
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

  addCompany: async (companyData) => {
    if (isFirebaseConfigured && db) {
      const docRef = await addDoc(collection(db!, 'companies'), {
        ...companyData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return docRef.id;
    } else {
      const id = `comp-${Date.now()}`;
      const newCompany: Company = {
        id,
        ...companyData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const list = [...get().companies, newCompany].sort((a, b) => a.name.localeCompare(b.name));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ companies: list });
      return id;
    }
  },

  updateCompany: async (id, updates) => {
    if (isFirebaseConfigured && db) {
      const docRef = doc(db!, 'companies', id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date(),
      });
    } else {
      const list = get().companies.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ companies: list });
    }
  },

  deleteCompany: async (id) => {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db!, 'companies', id));
    } else {
      const list = get().companies.filter((c) => c.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ companies: list });
    }
  },
}));
