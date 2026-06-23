import { create } from 'zustand';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: 'prospect' | 'client' | 'inactive';
  tier: 'A' | 'B' | 'C'; // Tier classification for cadence meeting suggestions
  companyId: string;
  companyName: string; 
  assignedSalespersonId: string;
  primaryOwner: string; // Mandatory Primary Owner for accountability
  street?: string;
  suburb?: string;
  state?: string;
  country?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
}

interface ContactState {
  contacts: Contact[];
  loading: boolean;
  initialized: boolean;
  initialize: () => () => void;
  addContact: (contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateContact: (id: string, updates: Partial<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
}

const STORAGE_KEY = 'northstar_contacts';
const SEED_CONTACTS: Contact[] = [
  {
    id: 'cont-1',
    name: 'Elon Musk',
    email: 'elon@tesla.com',
    phone: '1-800-555-4200',
    role: 'CEO',
    status: 'client',
    tier: 'A',
    companyId: 'comp-1',
    companyName: 'Tesla',
    assignedSalespersonId: 'sales-uid',
    primaryOwner: 'John Salesperson',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cont-2',
    name: 'Gwynne Shotwell',
    email: 'gwynne@spacex.com',
    phone: '1-800-555-4300',
    role: 'COO',
    status: 'client',
    tier: 'A',
    companyId: 'comp-2',
    companyName: 'SpaceX',
    assignedSalespersonId: 'sales-uid',
    primaryOwner: 'John Salesperson',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cont-3',
    name: 'Road Runner',
    email: 'runner@acme.com',
    phone: '1-800-555-4400',
    role: 'VP of Speed',
    status: 'prospect',
    tier: 'C',
    companyId: 'comp-3',
    companyName: 'Acme Corp',
    assignedSalespersonId: 'admin-uid',
    primaryOwner: 'Admin User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cont-4',
    name: 'Sundar Pichai',
    email: 'sundar@google.com',
    phone: '1-800-555-4500',
    role: 'CEO',
    status: 'prospect',
    tier: 'B',
    companyId: 'comp-4',
    companyName: 'Google',
    assignedSalespersonId: 'sales-uid',
    primaryOwner: 'John Salesperson',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  loading: true,
  initialized: false,

  initialize: () => {
    if (get().initialized) return () => {};

    if (isFirebaseConfigured && db) {
      const q = query(collection(db, 'contacts'), orderBy('name', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const contactList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          } as Contact;
        });
        set({ contacts: contactList, loading: false, initialized: true });
      }, (err) => {
        console.error('Error listening to contacts:', err);
        set({ loading: false });
      });
      return unsubscribe;
    } else {
      const loadLocal = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          set({ contacts: JSON.parse(stored), loading: false, initialized: true });
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_CONTACTS));
          set({ contacts: SEED_CONTACTS, loading: false, initialized: true });
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

  addContact: async (contactData) => {
    if (isFirebaseConfigured && db) {
      const docRef = await addDoc(collection(db!, 'contacts'), {
        ...contactData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return docRef.id;
    } else {
      const id = `cont-${Date.now()}`;
      const newContact: Contact = {
        id,
        ...contactData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const list = [...get().contacts, newContact].sort((a, b) => a.name.localeCompare(b.name));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ contacts: list });
      return id;
    }
  },

  updateContact: async (id, updates) => {
    if (isFirebaseConfigured && db) {
      const docRef = doc(db!, 'contacts', id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date(),
      });
    } else {
      const list = get().contacts.map((c) => {
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
      set({ contacts: list });
    }
  },

  deleteContact: async (id) => {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db!, 'contacts', id));
    } else {
      const list = get().contacts.filter((c) => c.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ contacts: list });
    }
  },
}));
