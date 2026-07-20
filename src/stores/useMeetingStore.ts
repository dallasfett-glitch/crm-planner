import { create } from 'zustand';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { useContactStore } from './useContactStore';
import { useNoteStore } from './useNoteStore';

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
  rejectMeeting: (id: string) => Promise<void>;
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

  // Core Automation Engine: Calculate and auto-populate cadence suggestion drafts
  runPredictiveSuggestions: () => {
    // Wait until contacts are loaded in useContactStore
    const contacts = useContactStore.getState().contacts;
    if (contacts.length === 0) {
      // Re-run whenever contacts populate
      const unsubContacts = useContactStore.subscribe((state) => {
        if (state.contacts.length > 0) {
          get().runPredictiveSuggestions();
          unsubContacts();
        }
      });
      return;
    }

    const meetingsList = get().meetings;
    const activeMonth = getActiveMonth();
    const cadences = JSON.parse(localStorage.getItem(CADENCE_KEY) || JSON.stringify(DEFAULT_CADENCES));
    const now = new Date();
    let updated = false;
    const newMeetings = [...meetingsList];

    contacts.forEach((contact) => {
      // 1. Skip inactive contacts
      if (contact.status === 'inactive') return;

      // 2. Check if there is already a meeting scheduled for this contact in the active month
      const hasMonthlyMeeting = meetingsList.some(
        (m) => m.contactId === contact.id && m.month === activeMonth
      );
      if (hasMonthlyMeeting) return;

      // 3. Find combined touchpoint dates (completed meetings and notes for contact + company)
      const notesList = useNoteStore.getState().notes;
      const contactMeets = meetingsList.filter((m) => m.contactId === contact.id && m.status === 'completed');
      const contactNotes = notesList.filter((n) => n.parentId === contact.id && n.parentType === 'contact');
      const companyMeets = contact.companyId ? meetingsList.filter((m) => m.companyId === contact.companyId && m.status === 'completed') : [];
      const companyNotes = contact.companyId ? notesList.filter((n) => n.parentId === contact.companyId && n.parentType === 'company') : [];

      let maxTouchpointTime = new Date(contact.createdAt).getTime();

      const checkMax = (dateStr: string) => {
        if (dateStr) {
          const t = new Date(dateStr).getTime();
          if (t > maxTouchpointTime) {
            maxTouchpointTime = t;
          }
        }
      };

      contactMeets.forEach((m) => checkMax(m.completedAt || m.scheduledAt));
      contactNotes.forEach((n) => checkMax(n.createdAt));
      companyMeets.forEach((m) => checkMax(m.completedAt || m.scheduledAt));
      companyNotes.forEach((n) => checkMax(n.createdAt));

      const hasAnyTouchpoint = contactMeets.length > 0 || contactNotes.length > 0 || companyMeets.length > 0 || companyNotes.length > 0;
      
      let lastMeetingDate = new Date(maxTouchpointTime);
      if (!hasAnyTouchpoint) {
        // Fallback to offset days to trigger immediate suggestion
        const offsetDays = contact.tier === 'A' ? 35 : contact.tier === 'B' ? 65 : 95;
        lastMeetingDate = new Date(now.getTime() - 1000 * 60 * 60 * 24 * offsetDays);
      }

      // 4. Calculate elapsed days
      const daysSinceLastMeeting = Math.max(0, Math.floor((now.getTime() - lastMeetingDate.getTime()) / (1000 * 60 * 60 * 24)));
      const cadenceThreshold = cadences[contact.tier] || DEFAULT_CADENCES[contact.tier];

      // 5. Trigger Suggestion
      if (daysSinceLastMeeting >= cadenceThreshold) {
        // Create suggested meeting details
        const suggestedDate = new Date();
        suggestedDate.setDate(suggestedDate.getDate() + ((3 + 7 - suggestedDate.getDay()) % 7 || 7));
        suggestedDate.setHours(10, 0, 0, 0);

        const newSuggestion: Meeting = {
          id: `suggested-${contact.id}-${activeMonth}`,
          contactId: contact.id,
          contactName: contact.name,
          companyId: contact.companyId,
          companyName: contact.companyName,
          salespersonId: contact.assignedSalespersonId || 'sales-uid',
          month: activeMonth,
          status: 'suggested',
          outcome: '',
          comments: '',
          whyContext: `Suggested: No touchpoint with ${contact.name} or their company in ${daysSinceLastMeeting} days (Tier ${contact.tier}).`,
          scheduledAt: suggestedDate.toISOString(),
          completedAt: null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        newMeetings.push(newSuggestion);
        updated = true;
      }
    });

    if (updated) {
      if (!isFirebaseConfigured) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newMeetings));
      }
      set({ meetings: newMeetings });
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
    
    // In Firebase context, suggested meetings might be client-side only drafts, so we save them as new documents
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
        scheduledAt: meeting.scheduledAt,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      // Filter out the local suggested draft
      set({ meetings: get().meetings.filter(m => m.id !== id) });
    } else {
      // Local Storage update
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
    const contacts = useContactStore.getState().contacts;
    if (contacts.length === 0) return;

    const cadences = JSON.parse(localStorage.getItem(CADENCE_KEY) || JSON.stringify(DEFAULT_CADENCES));
    const now = new Date();
    
    const targetMonths: string[] = [];
    for (let i = 0; i < 3; i++) {
      const temp = new Date();
      temp.setMonth(temp.getMonth() + i);
      targetMonths.push(`${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}`);
    }

    const meetingsList = [...get().meetings];
    let updated = false;

    targetMonths.forEach((targetMonth) => {
      contacts.forEach((contact) => {
        if (contact.status === 'inactive') return;

        const hasMeetingInMonth = meetingsList.some(
          (m) => m.contactId === contact.id && m.month === targetMonth
        );
        if (hasMeetingInMonth) return;

        const targetMonthStartDate = new Date(
          parseInt(targetMonth.split('-')[0]),
          parseInt(targetMonth.split('-')[1]) - 1,
          1
        );

        const notesList = useNoteStore.getState().notes;
        const contactMeets = meetingsList.filter(
          (m) => m.contactId === contact.id && (m.status === 'completed' || m.status === 'pending' || m.status === 'suggested')
        );
        const contactNotes = notesList.filter((n) => n.parentId === contact.id && n.parentType === 'contact');
        const companyMeets = contact.companyId
          ? meetingsList.filter((m) => m.companyId === contact.companyId && (m.status === 'completed' || m.status === 'pending' || m.status === 'suggested'))
          : [];
        const companyNotes = contact.companyId ? notesList.filter((n) => n.parentId === contact.companyId && n.parentType === 'company') : [];

        let maxTouchpointTime = new Date(contact.createdAt).getTime();

        const checkMax = (dateStr: string) => {
          if (dateStr) {
            const d = new Date(dateStr);
            if (d.getTime() < targetMonthStartDate.getTime() && d.getTime() > maxTouchpointTime) {
              maxTouchpointTime = d.getTime();
            }
          }
        };

        contactMeets.forEach((m) => checkMax(m.completedAt || m.scheduledAt));
        contactNotes.forEach((n) => checkMax(n.createdAt));
        companyMeets.forEach((m) => checkMax(m.completedAt || m.scheduledAt));
        companyNotes.forEach((n) => checkMax(n.createdAt));

        const hasTouchpoint = contactMeets.length > 0 || contactNotes.length > 0 || companyMeets.length > 0 || companyNotes.length > 0;
        
        let lastMeetingDate = new Date(maxTouchpointTime);
        if (!hasTouchpoint) {
          const offsetDays = contact.tier === 'A' ? 35 : contact.tier === 'B' ? 65 : 95;
          lastMeetingDate = new Date(targetMonthStartDate.getTime() - 1000 * 60 * 60 * 24 * offsetDays);
        }

        const daysSinceLastMeeting = Math.max(0, Math.floor((targetMonthStartDate.getTime() - lastMeetingDate.getTime()) / (1000 * 60 * 60 * 24)));
        const cadenceThreshold = cadences[contact.tier] || DEFAULT_CADENCES[contact.tier];

        const nextMeetingDueDate = new Date(lastMeetingDate.getTime() + cadenceThreshold * 24 * 60 * 60 * 1000);
        const targetMonthYear = parseInt(targetMonth.split('-')[0]);
        const targetMonthMonth = parseInt(targetMonth.split('-')[1]) - 1;
        const nextDueDateYear = nextMeetingDueDate.getFullYear();
        const nextDueDateMonth = nextMeetingDueDate.getMonth();

        const targetMonthsCount = targetMonthYear * 12 + targetMonthMonth;
        const dueMonthsCount = nextDueDateYear * 12 + nextDueDateMonth;

        if (dueMonthsCount <= targetMonthsCount) {
          let suggestedDate = new Date(nextMeetingDueDate.getTime());
          if (dueMonthsCount < targetMonthsCount) {
            suggestedDate = new Date(targetMonthStartDate.getTime());
            suggestedDate.setDate(suggestedDate.getDate() + ((3 + 7 - suggestedDate.getDay()) % 7 || 7));
          } else {
            const day = suggestedDate.getDay();
            if (day === 0) {
              suggestedDate.setDate(suggestedDate.getDate() + 1);
            } else if (day === 6) {
              suggestedDate.setDate(suggestedDate.getDate() - 1);
            }
          }
          suggestedDate.setHours(10, 0, 0, 0);

          const newSuggestion: Meeting = {
            id: `suggested-${contact.id}-${targetMonth}`,
            contactId: contact.id,
            contactName: contact.name,
            companyId: contact.companyId,
            companyName: contact.companyName,
            salespersonId: contact.assignedSalespersonId || 'sales-uid',
            month: targetMonth,
            status: 'suggested',
            outcome: '',
            comments: '',
            whyContext: `Forecasted: No touchpoint with ${contact.name} in ${daysSinceLastMeeting} days prior to ${targetMonth} (Tier ${contact.tier}).`,
            scheduledAt: suggestedDate.toISOString(),
            completedAt: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          };

          meetingsList.push(newSuggestion);
          updated = true;
        }
      });
    });

    if (updated) {
      if (isFirebaseConfigured && db) {
        const newSuggestionsOnly = meetingsList.filter(m => m.id.startsWith('suggested-') && !get().meetings.some(om => om.id === m.id));
        for (const sugg of newSuggestionsOnly) {
          await addDoc(collection(db!, 'meetings'), {
            ...sugg,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(meetingsList));
        set({ meetings: meetingsList });
      }
    }
  },
}));
