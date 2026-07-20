import { create } from 'zustand';
import { collection, onSnapshot, addDoc, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';

export interface Note {
  id: string;
  content: string;
  parentId: string;
  parentType: 'contact' | 'company' | 'deal';
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

interface NoteState {
  notes: Note[];
  loading: boolean;
  initialized: boolean;
  initialize: () => () => void;
  addNote: (note: Omit<Note, 'id' | 'createdAt'>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
}

const STORAGE_KEY = 'crm_notes';
const SEED_NOTES: Note[] = [
  {
    id: 'note-1',
    content: 'Met Elon at Giga Texas. He wants Cybertrucks in a dark slate shade. Highly enthusiastic.',
    parentId: 'cont-1',
    parentType: 'contact',
    createdBy: 'sales-uid',
    createdByName: 'John Salesperson',
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(), // 3 days ago
  },
  {
    id: 'note-2',
    content: 'Gwynne is looking at SpaceX flight expansion deals. Starlink pricing terms need checking.',
    parentId: 'comp-2',
    parentType: 'company',
    createdBy: 'sales-uid',
    createdByName: 'John Salesperson',
    createdAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(), // 1 day ago
  },
  {
    id: 'note-3',
    content: 'Acme wants heavy-duty anvils that can withstand impacts. Budget is a bit tight but they have recurring demand.',
    parentId: 'deal-3',
    parentType: 'deal',
    createdBy: 'admin-uid',
    createdByName: 'Admin User',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
  }
];

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  loading: true,
  initialized: false,

  initialize: () => {
    if (get().initialized) return () => {};

    if (isFirebaseConfigured && db) {
      const q = query(collection(db, 'notes'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const noteList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          } as Note;
        });
        set({ notes: noteList, loading: false, initialized: true });
      }, (err) => {
        console.error('Error listening to notes:', err);
        set({ loading: false });
      });
      return unsubscribe;
    } else {
      const loadLocal = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          set({ notes: JSON.parse(stored), loading: false, initialized: true });
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_NOTES));
          set({ notes: SEED_NOTES, loading: false, initialized: true });
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

  addNote: async (noteData) => {
    if (isFirebaseConfigured && db) {
      await addDoc(collection(db, 'notes'), {
        ...noteData,
        createdAt: new Date(),
      });
    } else {
      const newNote: Note = {
        id: `note-${Date.now()}`,
        ...noteData,
        createdAt: new Date().toISOString(),
      };
      const list = [newNote, ...get().notes]; // Ordered desc by default
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ notes: list });
    }
  },

  deleteNote: async (id) => {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, 'notes', id));
    } else {
      const list = get().notes.filter((n) => n.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ notes: list });
    }
  },
}));
