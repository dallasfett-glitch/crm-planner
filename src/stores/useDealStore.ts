import { create } from 'zustand';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';

export type DealStage = 'qualification' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';

export interface Deal {
  id: string;
  name: string;
  value: number;
  stage: DealStage;
  companyId: string;
  companyName: string;
  contactId: string;
  contactName: string;
  assignedSalespersonId: string;
  createdAt: string;
  updatedAt: string;
}

interface DealState {
  deals: Deal[];
  loading: boolean;
  initialized: boolean;
  initialize: () => () => void;
  addDeal: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateDeal: (id: string, updates: Partial<Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  updateDealStage: (id: string, stage: DealStage) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;
}

const STORAGE_KEY = 'crm_deals';
const SEED_DEALS: Deal[] = [
  {
    id: 'deal-1',
    name: '100 Cybertrucks Fleet',
    value: 5000000,
    stage: 'proposal',
    companyId: 'comp-1',
    companyName: 'Tesla',
    contactId: 'cont-1',
    contactName: 'Elon Musk',
    assignedSalespersonId: 'sales-uid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'deal-2',
    name: 'Starlink Satellite Block',
    value: 12000000,
    stage: 'negotiation',
    companyId: 'comp-2',
    companyName: 'SpaceX',
    contactId: 'cont-2',
    contactName: 'Gwynne Shotwell',
    assignedSalespersonId: 'sales-uid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'deal-3',
    name: 'Anvil Supply Contract',
    value: 50000,
    stage: 'qualification',
    companyId: 'comp-3',
    companyName: 'Acme Corp',
    contactId: 'cont-3',
    contactName: 'Road Runner',
    assignedSalespersonId: 'admin-uid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'deal-4',
    name: 'AdWords Optimization Package',
    value: 250000,
    stage: 'closed-won',
    companyId: 'comp-4',
    companyName: 'Google',
    contactId: 'cont-4',
    contactName: 'Sundar Pichai',
    assignedSalespersonId: 'sales-uid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const useDealStore = create<DealState>((set, get) => ({
  deals: [],
  loading: true,
  initialized: false,

  initialize: () => {
    if (get().initialized) return () => {};

    if (isFirebaseConfigured && db) {
      const q = query(collection(db, 'deals'), orderBy('name', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const dealList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          } as Deal;
        });
        set({ deals: dealList, loading: false, initialized: true });
      }, (err) => {
        console.error('Error listening to deals:', err);
        set({ loading: false });
      });
      return unsubscribe;
    } else {
      const loadLocal = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          set({ deals: JSON.parse(stored), loading: false, initialized: true });
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DEALS));
          set({ deals: SEED_DEALS, loading: false, initialized: true });
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

  addDeal: async (dealData) => {
    if (isFirebaseConfigured && db) {
      await addDoc(collection(db, 'deals'), {
        ...dealData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      const newDeal: Deal = {
        id: `deal-${Date.now()}`,
        ...dealData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const list = [...get().deals, newDeal];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ deals: list });
    }
  },

  updateDeal: async (id, updates) => {
    if (isFirebaseConfigured && db) {
      const docRef = doc(db, 'deals', id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date(),
      });
    } else {
      const list = get().deals.map((d) => {
        if (d.id === id) {
          return {
            ...d,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
        }
        return d;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ deals: list });
    }
  },

  updateDealStage: async (id, stage) => {
    await get().updateDeal(id, { stage });
  },

  deleteDeal: async (id) => {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, 'deals', id));
    } else {
      const list = get().deals.filter((d) => d.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ deals: list });
    }
  },
}));
