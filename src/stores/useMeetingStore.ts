import { create } from 'zustand';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { useContactStore, type Contact } from './useContactStore';
import { useNoteStore, type Note } from './useNoteStore';
import { getSpatialClusterKey, getSpatialClusterName } from '../utils/geocoding';

export interface Meeting {
  id: string;
  contactId: string;
  contactName: string;
  companyId: string;
  companyName: string;
  salespersonId: string;
  month: string; // YYYY-MM
  status: 'suggested' | 'pending' | 'completed';
  outcome: string;
  comments: string;
  whyContext?: string; // Cadence suggestion context
  clusterInfo?: {
    clusterKey?: string;
    clusterName?: string;
    clusterCount?: number;
    linkedContactNames?: string[];
  };
  scheduledAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  followUpDate?: string;
}

interface MeetingState {
  meetings: Meeting[];
  loading: boolean;
  initialized: boolean;
  initialize: () => () => void;
  addMeeting: (meeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateMeeting: (id: string, updates: Partial<Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  updateHistoricalOutcomes: (oldOutcome: string, newOutcome: string) => Promise<void>;
  approveMeeting: (id: string) => Promise<void>;
  approveAllSuggested: (month?: string, salespersonId?: string) => Promise<void>;
  approveCluster: (clusterKey: string, month?: string, salespersonId?: string) => Promise<void>;
  rejectMeeting: (id: string) => Promise<void>;
  editSuggestedMeeting: (id: string, updates: Partial<Meeting>) => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
  runPredictiveSuggestions: () => void;
  generateNext3MonthsSchedule: () => Promise<void>;
}

const STORAGE_KEY = 'crm_meetings';
const CADENCE_KEY = 'crm_cadence_settings';

// Default Cadence values
export const DEFAULT_CADENCES = { A: 30, B: 60, C: 90 };

const getActiveMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Seed baseline completed meetings to calculate elapsed time for suggestions
const getSeedMeetings = (): Meeting[] => {
  const currentMonth = getActiveMonth();
  const d = new Date();
  
  return [
    {
      id: 'meet-1',
      contactId: 'cont-1',
      contactName: 'Elon Musk',
      companyId: 'comp-1',
      companyName: 'Tesla',
      salespersonId: 'sales-uid',
      month: currentMonth,
      status: 'completed',
      outcome: 'deal progressed',
      comments: 'Discussed volume discounts for the fleet deal. Elon is interested in matching Cybertruck deliveries with charging infrastructure.',
      scheduledAt: new Date(d.getFullYear(), d.getMonth(), 5, 14, 0).toISOString(),
      completedAt: new Date(d.getFullYear(), d.getMonth(), 5, 15, 0).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'meet-seed-tesla-past1',
      contactId: 'cont-1',
      contactName: 'Elon Musk',
      companyId: 'comp-1',
      companyName: 'Tesla',
      salespersonId: 'sales-uid',
      month: `${new Date(Date.now() - 3600000 * 24 * 35).getFullYear()}-${String(new Date(Date.now() - 3600000 * 24 * 35).getMonth() + 1).padStart(2, '0')}`,
      status: 'completed',
      outcome: 'visit logged',
      comments: 'Logged a site visit at the Tesla showroom. Handled basic queries regarding their commercial account setup.',
      scheduledAt: new Date(Date.now() - 3600000 * 24 * 35).toISOString(),
      completedAt: new Date(Date.now() - 3600000 * 24 * 35).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'meet-2',
      contactId: 'cont-2',
      contactName: 'Gwynne Shotwell',
      companyId: 'comp-2',
      companyName: 'SpaceX',
      salespersonId: 'sales-uid',
      month: currentMonth,
      status: 'pending',
      outcome: '',
      comments: '',
      scheduledAt: new Date(d.getFullYear(), d.getMonth(), 22, 10, 0).toISOString(),
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'meet-seed-spacex-past1',
      contactId: 'cont-2',
      contactName: 'Gwynne Shotwell',
      companyId: 'comp-2',
      companyName: 'SpaceX',
      salespersonId: 'sales-uid',
      month: `${new Date(Date.now() - 3600000 * 24 * 10).getFullYear()}-${String(new Date(Date.now() - 3600000 * 24 * 10).getMonth() + 1).padStart(2, '0')}`,
      status: 'completed',
      outcome: 'visit logged',
      comments: 'Quarterly review meeting on SpaceX satellite network hardware components supply agreements.',
      scheduledAt: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
      completedAt: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'meet-seed-spacex-past2',
      contactId: 'cont-2',
      contactName: 'Gwynne Shotwell',
      companyId: 'comp-2',
      companyName: 'SpaceX',
      salespersonId: 'sales-uid',
      month: `${new Date(Date.now() - 3600000 * 24 * 45).getFullYear()}-${String(new Date(Date.now() - 3600000 * 24 * 45).getMonth() + 1).padStart(2, '0')}`,
      status: 'completed',
      outcome: 'deal progressed',
      comments: 'Initial contract alignment for cargo delivery systems software licenses.',
      scheduledAt: new Date(Date.now() - 3600000 * 24 * 45).toISOString(),
      completedAt: new Date(Date.now() - 3600000 * 24 * 45).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'meet-3',
      contactId: 'cont-4',
      contactName: 'Sundar Pichai',
      companyId: 'comp-4',
      companyName: 'Google',
      salespersonId: 'sales-uid',
      month: currentMonth,
      status: 'completed',
      outcome: 'deal progressed',
      comments: 'Presented AdWords premium optimization tiers. Sundar liked the ROI estimates. Approved moving to contract drafting.',
      scheduledAt: new Date(d.getFullYear(), d.getMonth(), 10, 11, 30).toISOString(),
      completedAt: new Date(d.getFullYear(), d.getMonth(), 10, 12, 15).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'meet-seed-google-past1',
      contactId: 'cont-4',
      contactName: 'Sundar Pichai',
      companyId: 'comp-4',
      companyName: 'Google',
      salespersonId: 'sales-uid',
      month: `${new Date(Date.now() - 3600000 * 24 * 40).getFullYear()}-${String(new Date(Date.now() - 3600000 * 24 * 40).getMonth() + 1).padStart(2, '0')}`,
      status: 'completed',
      outcome: 'visit logged',
      comments: 'Explored multi-brand cloud analytics dashboard integrations. Sundar provided inputs on their strict compliance requirements.',
      scheduledAt: new Date(Date.now() - 3600000 * 24 * 40).toISOString(),
      completedAt: new Date(Date.now() - 3600000 * 24 * 40).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'meet-4',
      contactId: 'cont-3',
      contactName: 'Road Runner',
      companyId: 'comp-3',
      companyName: 'Acme Corp',
      salespersonId: 'admin-uid',
      month: currentMonth,
      status: 'pending',
      outcome: '',
      comments: '',
      scheduledAt: new Date(d.getFullYear(), d.getMonth(), 28, 16, 0).toISOString(),
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'meet-seed-acme-past1',
      contactId: 'cont-3',
      contactName: 'Road Runner',
      companyId: 'comp-3',
      companyName: 'Acme Corp',
      salespersonId: 'admin-uid',
      month: `${new Date(Date.now() - 3600000 * 24 * 95).getFullYear()}-${String(new Date(Date.now() - 3600000 * 24 * 95).getMonth() + 1).padStart(2, '0')}`,
      status: 'completed',
      outcome: 'visit logged',
      comments: 'Discussions on specialized explosive trap setups and safety standards. Client requested custom shipment guarantees.',
      scheduledAt: new Date(Date.now() - 3600000 * 24 * 95).toISOString(),
      completedAt: new Date(Date.now() - 3600000 * 24 * 95).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];
};

export const useMeetingStore = create<MeetingState>((set, get) => ({
  meetings: [],
  loading: true,
  initialized: false,

  initialize: () => {
    if (get().initialized) return () => {};

    if (isFirebaseConfigured && db) {
      const q = query(collection(db, 'meetings'), orderBy('scheduledAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const meetingList = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            scheduledAt: data.scheduledAt instanceof Timestamp ? data.scheduledAt.toDate().toISOString() : data.scheduledAt,
            completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate().toISOString() : data.completedAt,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          } as Meeting;
        });
        set({ meetings: meetingList, loading: false, initialized: true });
        
        // Run cadence suggestions check
        get().runPredictiveSuggestions();
      }, (err) => {
        console.error('Error listening to meetings:', err);
        set({ loading: false });
      });
      return unsubscribe;
    } else {
      const loadLocal = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          set({ meetings: JSON.parse(stored), loading: false, initialized: true });
        } else {
          const seed = getSeedMeetings();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
          set({ meetings: seed, loading: false, initialized: true });
        }
        
        // Run cadence suggestions check
        get().runPredictiveSuggestions();
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

  // Core Automation Engine: Calculate and auto-populate 3-month cadence suggestion drafts across all salespeople
  runPredictiveSuggestions: () => {
    // Wait until contacts are loaded in useContactStore
    const contacts = useContactStore.getState().contacts;
    if (contacts.length === 0) {
      const unsubContacts = useContactStore.subscribe((state) => {
        if (state.contacts.length > 0) {
          get().runPredictiveSuggestions();
          unsubContacts();
        }
      });
      return;
    }

    const meetingsList = get().meetings;
    const cadences = JSON.parse(localStorage.getItem(CADENCE_KEY) || JSON.stringify(DEFAULT_CADENCES));
    const notes = useNoteStore.getState().notes;

    const { updatedMeetings, hasChanges } = build3MonthPredictiveSchedule(
      meetingsList,
      contacts,
      notes,
      cadences
    );

    if (hasChanges) {
      if (!isFirebaseConfigured) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMeetings));
      }
      set({ meetings: updatedMeetings });
    }
  },

  addMeeting: async (meetingData) => {
    if (isFirebaseConfigured && db) {
      await addDoc(collection(db!, 'meetings'), {
        ...meetingData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      const newMeeting: Meeting = {
        id: `meet-${Date.now()}`,
        ...meetingData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const list = [...get().meetings, newMeeting].sort((a, b) => 
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ meetings: list });
    }
  },

  updateMeeting: async (id, updates) => {
    const originalMeeting = get().meetings.find(m => m.id === id);
    let rescheduledMeeting: Meeting | null = null;
    
    if (originalMeeting && updates.outcome === 'missed / cancelled') {
      const parts = originalMeeting.month.split('-');
      let year = parseInt(parts[0]);
      let month = parseInt(parts[1]) + 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      const nextMonthStr = `${year}-${String(month).padStart(2, '0')}`;
      
      const hasNextMonthMeet = get().meetings.some(
        (m) => m.contactId === originalMeeting.contactId && m.month === nextMonthStr
      );
      
      if (!hasNextMonthMeet) {
        const now = new Date();
        const suggestedDate = new Date();
        suggestedDate.setMonth(suggestedDate.getMonth() + 1);
        suggestedDate.setDate(suggestedDate.getDate() + ((3 + 7 - suggestedDate.getDay()) % 7 || 7));
        suggestedDate.setHours(10, 0, 0, 0);

        rescheduledMeeting = {
          id: `suggested-${originalMeeting.contactId}-${nextMonthStr}`,
          contactId: originalMeeting.contactId,
          contactName: originalMeeting.contactName,
          companyId: originalMeeting.companyId,
          companyName: originalMeeting.companyName,
          salespersonId: originalMeeting.salespersonId || 'sales-uid',
          month: nextMonthStr,
          status: 'suggested',
          outcome: '',
          comments: '',
          whyContext: `Auto-rescheduled: previous meeting in ${originalMeeting.month} was missed/cancelled.`,
          scheduledAt: suggestedDate.toISOString(),
          completedAt: null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
      }
    }

    if (isFirebaseConfigured && db) {
      const docRef = doc(db!, 'meetings', id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date(),
      });
      if (rescheduledMeeting) {
        await addDoc(collection(db!, 'meetings'), {
          ...rescheduledMeeting,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } else {
      const list = get().meetings.map((m) => {
        if (m.id === id) {
          return {
            ...m,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
        }
        return m;
      });
      if (rescheduledMeeting) {
        list.push(rescheduledMeeting);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ meetings: list });
    }
  },

  updateHistoricalOutcomes: async (oldOutcome, newOutcome) => {
    if (isFirebaseConfigured && db) {
      const meetingsToUpdate = get().meetings.filter(m => m.outcome === oldOutcome);
      for (const m of meetingsToUpdate) {
        const docRef = doc(db!, 'meetings', m.id);
        await updateDoc(docRef, {
          outcome: newOutcome,
          updatedAt: new Date()
        });
      }
    }
    const list = get().meetings.map((m) => {
      if (m.outcome === oldOutcome) {
        return {
          ...m,
          outcome: newOutcome,
          updatedAt: new Date().toISOString(),
        };
      }
      return m;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    set({ meetings: list });
  },

  // Flips status from suggested to pending, locking it in
  approveMeeting: async (id) => {
    const meeting = get().meetings.find(m => m.id === id);
    if (!meeting) return;
    
    if (isFirebaseConfigured && db) {
      await addDoc(collection(db!, 'meetings'), {
        contactId: meeting.contactId,
        contactName: meeting.contactName,
        companyId: meeting.companyId,
        companyName: meeting.companyName,
        salespersonId: meeting.salespersonId,
        month: meeting.month,
        status: 'pending',
        outcome: '',
        comments: '',
        whyContext: meeting.whyContext || '',
        clusterInfo: meeting.clusterInfo || null,
        scheduledAt: meeting.scheduledAt,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      set({ meetings: get().meetings.filter(m => m.id !== id) });
    } else {
      const list = get().meetings.map(m => {
        if (m.id === id) {
          return {
            ...m,
            status: 'pending' as const,
            updatedAt: new Date().toISOString()
          };
        }
        return m;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ meetings: list });
    }
  },

  // Batch approve all suggestions matching optional month / salesperson filters
  approveAllSuggested: async (month?: string, salespersonId?: string) => {
    const currentMeetings = get().meetings;
    const toApprove = currentMeetings.filter(m => {
      if (m.status !== 'suggested') return false;
      if (month && m.month !== month) return false;
      if (salespersonId && m.salespersonId !== salespersonId) return false;
      return true;
    });

    if (toApprove.length === 0) return;

    if (isFirebaseConfigured && db) {
      for (const m of toApprove) {
        await addDoc(collection(db!, 'meetings'), {
          contactId: m.contactId,
          contactName: m.contactName,
          companyId: m.companyId,
          companyName: m.companyName,
          salespersonId: m.salespersonId,
          month: m.month,
          status: 'pending',
          outcome: '',
          comments: '',
          whyContext: m.whyContext || '',
          clusterInfo: m.clusterInfo || null,
          scheduledAt: m.scheduledAt,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      const toApproveIds = new Set(toApprove.map(m => m.id));
      set({ meetings: currentMeetings.filter(m => !toApproveIds.has(m.id)) });
    } else {
      const toApproveIds = new Set(toApprove.map(m => m.id));
      const list = currentMeetings.map(m => {
        if (toApproveIds.has(m.id)) {
          return {
            ...m,
            status: 'pending' as const,
            updatedAt: new Date().toISOString()
          };
        }
        return m;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ meetings: list });
    }
  },

  // Batch approve all suggestions in a specific geographic cluster
  approveCluster: async (clusterKey: string, month?: string, salespersonId?: string) => {
    const currentMeetings = get().meetings;
    const toApprove = currentMeetings.filter(m => {
      if (m.status !== 'suggested') return false;
      if (m.clusterInfo?.clusterKey !== clusterKey) return false;
      if (month && m.month !== month) return false;
      if (salespersonId && m.salespersonId !== salespersonId) return false;
      return true;
    });

    if (toApprove.length === 0) return;

    if (isFirebaseConfigured && db) {
      for (const m of toApprove) {
        await addDoc(collection(db!, 'meetings'), {
          contactId: m.contactId,
          contactName: m.contactName,
          companyId: m.companyId,
          companyName: m.companyName,
          salespersonId: m.salespersonId,
          month: m.month,
          status: 'pending',
          outcome: '',
          comments: '',
          whyContext: m.whyContext || '',
          clusterInfo: m.clusterInfo || null,
          scheduledAt: m.scheduledAt,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      const toApproveIds = new Set(toApprove.map(m => m.id));
      set({ meetings: currentMeetings.filter(m => !toApproveIds.has(m.id)) });
    } else {
      const toApproveIds = new Set(toApprove.map(m => m.id));
      const list = currentMeetings.map(m => {
        if (toApproveIds.has(m.id)) {
          return {
            ...m,
            status: 'pending' as const,
            updatedAt: new Date().toISOString()
          };
        }
        return m;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ meetings: list });
    }
  },

  // Edit / customize a suggested meeting draft
  editSuggestedMeeting: async (id: string, updates: Partial<Meeting>) => {
    const currentMeetings = get().meetings;
    const list = currentMeetings.map(m => {
      if (m.id === id) {
        const updatedMonth = updates.scheduledAt 
          ? `${new Date(updates.scheduledAt).getFullYear()}-${String(new Date(updates.scheduledAt).getMonth() + 1).padStart(2, '0')}`
          : m.month;
        return {
          ...m,
          ...updates,
          month: updatedMonth,
          updatedAt: new Date().toISOString()
        };
      }
      return m;
    });
    if (!isFirebaseConfigured) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
    set({ meetings: list });
  },

  // Deletes suggestion draft
  rejectMeeting: async (id) => {
    if (isFirebaseConfigured && db && !id.startsWith('suggested-')) {
      await deleteDoc(doc(db!, 'meetings', id));
    } else {
      const list = get().meetings.filter(m => m.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ meetings: list });
    }
  },

  deleteMeeting: async (id) => {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db!, 'meetings', id));
    } else {
      const list = get().meetings.filter((m) => m.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      set({ meetings: list });
    }
  },

  generateNext3MonthsSchedule: async () => {
    get().runPredictiveSuggestions();
  },
}));

/**
 * Pure helper function to project and generate 3-month conflict-free cadence suggestions
 * with geographic proximity clustering across all salespeople.
 */
function build3MonthPredictiveSchedule(
  currentMeetings: Meeting[],
  contacts: Contact[],
  notes: Note[],
  cadences: Record<string, number>
): { updatedMeetings: Meeting[]; hasChanges: boolean } {
  if (!contacts || contacts.length === 0) {
    return { updatedMeetings: currentMeetings, hasChanges: false };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // 3-month rolling window: month 0, month 1, month 2
  const targetMonths: { monthStr: string; year: number; monthIdx: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(currentYear, currentMonth + i, 1);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    targetMonths.push({ monthStr: mStr, year: d.getFullYear(), monthIdx: d.getMonth() });
  }

  let updated = false;
  const meetingsList = [...currentMeetings];

  // Distinct salesperson IDs
  const salespersonIds = new Set<string>();
  contacts.forEach((c) => {
    if (c.assignedSalespersonId) {
      salespersonIds.add(c.assignedSalespersonId);
    }
  });
  if (salespersonIds.size === 0) {
    salespersonIds.add('sales-uid');
    salespersonIds.add('admin-uid');
  }

  // Process month by month
  targetMonths.forEach(({ monthStr, year, monthIdx }, mOffset) => {
    const targetMonthStartDate = new Date(year, monthIdx, 1);

    salespersonIds.forEach((salespersonId) => {
      // Find active contacts assigned to this salesperson
      const repContacts = contacts.filter(
        (c) =>
          c.status !== 'inactive' &&
          (c.assignedSalespersonId === salespersonId ||
            (!c.assignedSalespersonId && salespersonId === 'sales-uid'))
      );

      if (repContacts.length === 0) return;

      // Identify which contacts need a meeting in this target month
      const dueContacts: { contact: Contact; daysSince: number; clusterKey: string; clusterName: string }[] = [];

      repContacts.forEach((contact) => {
        // Skip if already scheduled (suggested, pending, or completed) in this month
        const hasMeetingInMonth = meetingsList.some(
          (m) => m.contactId === contact.id && m.month === monthStr
        );
        if (hasMeetingInMonth) return;

        // Calculate latest touchpoint (completed meetings or notes)
        const contactMeets = meetingsList.filter(
          (m) => m.contactId === contact.id && (m.status === 'completed' || m.status === 'pending')
        );
        const contactNotes = notes.filter((n) => n.parentId === contact.id && n.parentType === 'contact');
        const companyMeets = contact.companyId
          ? meetingsList.filter((m) => m.companyId === contact.companyId && (m.status === 'completed' || m.status === 'pending'))
          : [];
        const companyNotes = contact.companyId
          ? notes.filter((n) => n.parentId === contact.companyId && n.parentType === 'company')
          : [];

        let maxTouchpointTime = new Date(contact.createdAt).getTime();
        const checkMax = (dateStr?: string | null) => {
          if (dateStr) {
            const t = new Date(dateStr).getTime();
            if (t > maxTouchpointTime) maxTouchpointTime = t;
          }
        };

        contactMeets.forEach((m) => checkMax(m.completedAt || m.scheduledAt));
        contactNotes.forEach((n) => checkMax(n.createdAt));
        companyMeets.forEach((m) => checkMax(m.completedAt || m.scheduledAt));
        companyNotes.forEach((n) => checkMax(n.createdAt));

        const hasAnyTouchpoint =
          contactMeets.length > 0 || contactNotes.length > 0 || companyMeets.length > 0 || companyNotes.length > 0;

        let lastMeetingDate = new Date(maxTouchpointTime);
        if (!hasAnyTouchpoint) {
          const offsetDays = contact.tier === 'A' ? 35 : contact.tier === 'B' ? 65 : 95;
          lastMeetingDate = new Date(now.getTime() - 1000 * 60 * 60 * 24 * offsetDays);
        }

        // Days elapsed relative to target month start
        const referenceTime = mOffset === 0 ? now.getTime() : targetMonthStartDate.getTime();
        const daysSinceLastMeeting = Math.max(
          0,
          Math.floor((referenceTime - lastMeetingDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        const cadenceThreshold = cadences[contact.tier] || DEFAULT_CADENCES[contact.tier];

        if (daysSinceLastMeeting >= cadenceThreshold) {
          const clusterKey = getSpatialClusterKey(contact);
          const clusterName = getSpatialClusterName(contact);
          dueContacts.push({ contact, daysSince: daysSinceLastMeeting, clusterKey, clusterName });
        }
      });

      if (dueContacts.length === 0) return;

      // Group due contacts by geographic cluster
      const clusters: Record<string, typeof dueContacts> = {};
      dueContacts.forEach((item) => {
        if (!clusters[item.clusterKey]) clusters[item.clusterKey] = [];
        clusters[item.clusterKey].push(item);
      });

      // Find available business days (Monday-Friday) in target month
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
      const businessDays: number[] = [];
      const startDay = mOffset === 0 ? Math.max(1, now.getDate() + 1) : 1;

      for (let day = startDay; day <= daysInMonth; day++) {
        const d = new Date(year, monthIdx, day);
        const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          businessDays.push(day);
        }
      }
      if (businessDays.length === 0) {
        businessDays.push(Math.min(15, daysInMonth));
      }

      // Candidate standard time slots for visits
      const timeSlots = [
        { hour: 9, minute: 30 },
        { hour: 11, minute: 30 },
        { hour: 14, minute: 0 },
        { hour: 15, minute: 30 },
      ];

      // Assign each cluster to an available day
      let dayIndex = 0;
      Object.keys(clusters).forEach((cKey) => {
        const clusterItems = clusters[cKey];
        const clusterName = clusterItems[0].clusterName;
        const linkedNames = clusterItems.map((ci) => ci.contact.name);

        // Pick assigned business day for this cluster
        const assignedDay = businessDays[dayIndex % businessDays.length];
        dayIndex = (dayIndex + 1) % businessDays.length;

        clusterItems.forEach((ci, slotIdx) => {
          const slot = timeSlots[slotIdx % timeSlots.length];
          const scheduledDate = new Date(year, monthIdx, assignedDay, slot.hour, slot.minute, 0);

          // If current month and slot is in the past, push forward by a few days
          if (mOffset === 0 && scheduledDate.getTime() < now.getTime()) {
            scheduledDate.setDate(Math.min(daysInMonth, now.getDate() + 2 + slotIdx));
            const dow = scheduledDate.getDay();
            if (dow === 0) scheduledDate.setDate(scheduledDate.getDate() + 1);
            if (dow === 6) scheduledDate.setDate(scheduledDate.getDate() + 2);
          }

          const newSuggestion: Meeting = {
            id: `suggested-${ci.contact.id}-${monthStr}`,
            contactId: ci.contact.id,
            contactName: ci.contact.name,
            companyId: ci.contact.companyId,
            companyName: ci.contact.companyName,
            salespersonId: salespersonId,
            month: monthStr,
            status: 'suggested',
            outcome: '',
            comments: '',
            whyContext: `Suggested: No touchpoint with ${ci.contact.name} in ${ci.daysSince} days (Tier ${ci.contact.tier}). ${
              clusterItems.length > 1
                ? `Grouped with ${linkedNames.filter((n) => n !== ci.contact.name).join(', ')} in ${clusterName}.`
                : `Located in ${clusterName}.`
            }`,
            clusterInfo: {
              clusterKey: cKey,
              clusterName: clusterName,
              clusterCount: clusterItems.length,
              linkedContactNames: linkedNames.filter((n) => n !== ci.contact.name),
            },
            scheduledAt: scheduledDate.toISOString(),
            completedAt: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          };

          meetingsList.push(newSuggestion);
          updated = true;
        });
      });
    });
  });

  return { updatedMeetings: meetingsList, hasChanges: updated };
}
