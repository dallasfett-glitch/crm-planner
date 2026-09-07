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
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Contact A (Tier A, threshold 30, elapsed 35) should have a suggested meeting in the active month
    const suggestionA = meetings.find(m => m.contactId === 'contact-a' && m.month === currentMonthStr && m.status === 'suggested');
    expect(suggestionA).toBeDefined();
    expect(suggestionA?.whyContext).toContain('Tier A');

    // Contact B (Tier B, threshold 60, elapsed 45) should NOT have a suggested meeting in the active month
    const currentMonthSuggestionB = meetings.find(m => m.contactId === 'contact-b' && m.month === currentMonthStr && m.status === 'suggested');
    expect(currentMonthSuggestionB).toBeUndefined();

    // But Contact B SHOULD be forecasted in future months (when elapsed days exceed 60)
    const futureSuggestionB = meetings.find(m => m.contactId === 'contact-b' && m.month !== currentMonthStr && m.status === 'suggested');
    expect(futureSuggestionB).toBeDefined();
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

  it('should generate 3-month suggested outlook with geographic proximity clustering across multiple salespeople', async () => {
    const now = new Date();
    // 3 contacts: 2 in Richmond assigned to rep-1, 1 in South Yarra assigned to rep-2
    const mockContacts = [
      {
        id: 'c-rep1-richmond-1',
        name: 'Contact One',
        email: 'one@test.com',
        phone: '111',
        role: 'Buyer',
        status: 'client' as const,
        tier: 'A' as const,
        companyId: 'comp-1',
        companyName: 'Richmond Tech',
        assignedSalespersonId: 'rep-1',
        primaryOwner: 'Rep 1',
        suburb: 'Richmond',
        state: 'VIC',
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 60).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'c-rep1-richmond-2',
        name: 'Contact Two',
        email: 'two@test.com',
        phone: '222',
        role: 'Director',
        status: 'client' as const,
        tier: 'A' as const,
        companyId: 'comp-2',
        companyName: 'Richmond Logistics',
        assignedSalespersonId: 'rep-1',
        primaryOwner: 'Rep 1',
        suburb: 'Richmond',
        state: 'VIC',
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 60).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'c-rep2-southyarra',
        name: 'Contact Three',
        email: 'three@test.com',
        phone: '333',
        role: 'Manager',
        status: 'client' as const,
        tier: 'A' as const,
        companyId: 'comp-3',
        companyName: 'SY Retail',
        assignedSalespersonId: 'rep-2',
        primaryOwner: 'Rep 2',
        suburb: 'South Yarra',
        state: 'VIC',
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 60).toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    useContactStore.setState({ contacts: mockContacts as any, loading: false, initialized: true });
    useMeetingStore.setState({ meetings: [], loading: false, initialized: true });

    // Run engine
    useMeetingStore.getState().runPredictiveSuggestions();

    const meetings = useMeetingStore.getState().meetings;

    // Rep 1 should have suggested meetings with clusterInfo
    const rep1Suggestions = meetings.filter(m => m.salespersonId === 'rep-1' && m.status === 'suggested');
    expect(rep1Suggestions.length).toBeGreaterThan(0);

    const richmond1 = rep1Suggestions.find(m => m.contactId === 'c-rep1-richmond-1');
    const richmond2 = rep1Suggestions.find(m => m.contactId === 'c-rep1-richmond-2');
    expect(richmond1).toBeDefined();
    expect(richmond2).toBeDefined();
    expect(richmond1?.clusterInfo?.clusterKey).toBe('richmond-vic');
    expect(richmond1?.clusterInfo?.clusterCount).toBe(2);

    // Verify non-overlapping time slots on the same day for co-located contacts
    if (richmond1 && richmond2 && richmond1.month === richmond2.month) {
      expect(richmond1.scheduledAt).not.toBe(richmond2.scheduledAt);
    }

    // Rep 2 should also have suggestions populated automatically
    const rep2Suggestions = meetings.filter(m => m.salespersonId === 'rep-2' && m.status === 'suggested');
    expect(rep2Suggestions.length).toBeGreaterThan(0);
  });

  it('should support batch approval for an entire cluster and all suggestions', async () => {
    const mockSuggestions = [
      {
        id: 'sugg-1',
        contactId: 'c1',
        contactName: 'Alpha',
        companyId: 'comp1',
        companyName: 'Comp1',
        salespersonId: 'rep-1',
        month: '2026-08',
        status: 'suggested' as const,
        outcome: '',
        comments: '',
        clusterInfo: { clusterKey: 'richmond-vic', clusterName: 'Richmond Territory' },
        scheduledAt: new Date().toISOString(),
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'sugg-2',
        contactId: 'c2',
        contactName: 'Beta',
        companyId: 'comp2',
        companyName: 'Comp2',
        salespersonId: 'rep-1',
        month: '2026-08',
        status: 'suggested' as const,
        outcome: '',
        comments: '',
        clusterInfo: { clusterKey: 'richmond-vic', clusterName: 'Richmond Territory' },
        scheduledAt: new Date().toISOString(),
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'sugg-3',
        contactId: 'c3',
        contactName: 'Gamma',
        companyId: 'comp3',
        companyName: 'Comp3',
        salespersonId: 'rep-2',
        month: '2026-08',
        status: 'suggested' as const,
        outcome: '',
        comments: '',
        clusterInfo: { clusterKey: 'hawthorn-vic', clusterName: 'Hawthorn Territory' },
        scheduledAt: new Date().toISOString(),
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    useMeetingStore.setState({ meetings: mockSuggestions as any, loading: false, initialized: true });

    // 1. Approve cluster 'richmond-vic'
    await useMeetingStore.getState().approveCluster('richmond-vic');
    let meetings = useMeetingStore.getState().meetings;

    expect(meetings.find(m => m.id === 'sugg-1')?.status).toBe('pending');
    expect(meetings.find(m => m.id === 'sugg-2')?.status).toBe('pending');
    expect(meetings.find(m => m.id === 'sugg-3')?.status).toBe('suggested');

    // 2. Approve all remaining suggestions
    await useMeetingStore.getState().approveAllSuggested();
    meetings = useMeetingStore.getState().meetings;
    expect(meetings.every(m => m.status === 'pending')).toBe(true);
  });
});
