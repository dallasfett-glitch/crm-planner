/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Establish LocalStorage mock before importing stores
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
(globalThis as any).localStorage = localStorageMock as any;
(globalThis as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
} as any;

// Mock Firebase config to prevent import crash
vi.mock('../../firebase', () => ({
  db: null,
  isFirebaseConfigured: false,
}));

import { useMeetingStore } from '../useMeetingStore';
import { useContactStore } from '../useContactStore';
import { useNoteStore } from '../useNoteStore';

describe('useMeetingStore - Cadence & Scheduling Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset Zustand stores manually
    useMeetingStore.setState({ meetings: [], loading: true, initialized: false });
    useContactStore.setState({ contacts: [], loading: true, initialized: false });
    useNoteStore.setState({ notes: [], loading: true, initialized: false });
  });

  it('should initialize and load default meetings', () => {
    const unsub = useMeetingStore.getState().initialize();
    expect(useMeetingStore.getState().meetings.length).toBeGreaterThan(0);
    unsub();
  });

  it('should trigger predictive suggestions based on contact tier cadence', async () => {
    // 1. Setup mock contacts
    const now = new Date();
    // Contact 1: Tier A (30 days cadence). Last touchpoint was 35 days ago (should suggest)
    // Contact 2: Tier B (60 days cadence). Last touchpoint was 45 days ago (should NOT suggest)
    const mockContacts = [
      {
        id: 'contact-a',
        name: 'Alice TierA',
        email: 'alice@a.com',
        phone: '123',
        role: 'CEO',
        status: 'client' as const,
        tier: 'A' as const,
        companyId: 'comp-a',
        companyName: 'Company A',
        assignedSalespersonId: 'sales-uid',
        primaryOwner: 'John Salesperson',
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 50).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'contact-b',
        name: 'Bob TierB',
        email: 'bob@b.com',
        phone: '456',
        role: 'CEO',
        status: 'client' as const,
        tier: 'B' as const,
        companyId: 'comp-b',
        companyName: 'Company B',
        assignedSalespersonId: 'sales-uid',
        primaryOwner: 'John Salesperson',
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 50).toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    // Contact A last touchpoint (completed meeting) was 35 days ago
    const lastMeetingA = {
      id: 'meet-prev-a',
      contactId: 'contact-a',
      contactName: 'Alice TierA',
      companyId: 'comp-a',
      companyName: 'Company A',
      salespersonId: 'sales-uid',
      month: '2026-06',
      status: 'completed' as const,
      outcome: 'deal progressed',
      comments: 'past visit',
      scheduledAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 35).toISOString(),
      completedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 35).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Contact B last touchpoint (completed meeting) was 45 days ago
    const lastMeetingB = {
      id: 'meet-prev-b',
      contactId: 'contact-b',
      contactName: 'Bob TierB',
      companyId: 'comp-b',
      companyName: 'Company B',
      salespersonId: 'sales-uid',
      month: '2026-06',
      status: 'completed' as const,
      outcome: 'deal progressed',
      comments: 'past visit',
      scheduledAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 45).toISOString(),
      completedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 45).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem('crm_contacts', JSON.stringify(mockContacts));
    localStorage.setItem('crm_meetings', JSON.stringify([lastMeetingA, lastMeetingB]));

    // Initialize stores
    useMeetingStore.getState().initialize();
    useContactStore.getState().initialize();

    // Trigger cadence check
    useMeetingStore.getState().runPredictiveSuggestions();

    const meetings = useMeetingStore.getState().meetings;

    // Contact A (Tier A, threshold 30, elapsed 35) should have a suggested meeting
    const suggestionA = meetings.find(m => m.contactId === 'contact-a' && m.status === 'suggested');
    expect(suggestionA).toBeDefined();
    expect(suggestionA?.whyContext).toContain('Tier A');

    // Contact B (Tier B, threshold 60, elapsed 45) should NOT have a suggested meeting
    const suggestionB = meetings.find(m => m.contactId === 'contact-b' && m.status === 'suggested');
    expect(suggestionB).toBeUndefined();
  });

  it('should lock in suggested meeting to pending on approval', async () => {
    const mockSuggestion = {
      id: 'suggested-c1-2026-07',
      contactId: 'c1',
      contactName: 'Charlie',
      companyId: 'comp1',
      companyName: 'Comp1',
      salespersonId: 'sales-uid',
      month: '2026-07',
      status: 'suggested' as const,
      outcome: '',
      comments: '',
      scheduledAt: new Date().toISOString(),
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    localStorage.setItem('crm_meetings', JSON.stringify([mockSuggestion]));
    useMeetingStore.getState().initialize();

    await useMeetingStore.getState().approveMeeting('suggested-c1-2026-07');

    const meetings = useMeetingStore.getState().meetings;
    const approved = meetings.find(m => m.contactId === 'c1');
    expect(approved).toBeDefined();
    expect(approved?.status).toBe('pending');
  });

  it('should auto-reschedule missed/cancelled meetings into the next month', async () => {
    const scheduledMeeting = {
      id: 'meet-missed-1',
      contactId: 'c1',
      contactName: 'Charlie',
      companyId: 'comp1',
      companyName: 'Comp1',
      salespersonId: 'sales-uid',
      month: '2026-07',
      status: 'pending' as const,
      outcome: '',
      comments: '',
      scheduledAt: new Date().toISOString(),
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem('crm_meetings', JSON.stringify([scheduledMeeting]));
    useMeetingStore.getState().initialize();

    // Mark as missed/cancelled
    await useMeetingStore.getState().updateMeeting('meet-missed-1', {
      outcome: 'missed / cancelled',
    });

    const meetings = useMeetingStore.getState().meetings;

    // Check original meeting outcome updated
    const updatedPrev = meetings.find(m => m.id === 'meet-missed-1');
    expect(updatedPrev?.outcome).toBe('missed / cancelled');

    // Verify a new suggested meeting is auto-scheduled for the next month
    const nextMonthMeet = meetings.find(m => m.contactId === 'c1' && m.status === 'suggested');
    expect(nextMonthMeet).toBeDefined();
    expect(nextMonthMeet?.whyContext).toContain('Auto-rescheduled');
  });
});
