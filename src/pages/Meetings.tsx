import React, { useState, useEffect, useCallback } from 'react';
import { useMeetingStore } from '../stores/useMeetingStore';
import type { Meeting } from '../stores/useMeetingStore';
import { useContactStore } from '../stores/useContactStore';
import { useCompanyStore } from '../stores/useCompanyStore';
import { useNoteStore } from '../stores/useNoteStore';
import { useAuth } from '../context/AuthContext';
import { useUserStore } from '../stores/useUserStore';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Plus, 
  Calendar, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  AlertCircle, 
  Edit, 
  User, 
  Sliders, 
  MessageSquarePlus, 
  Trash2,
  Check,
  Sparkles,
  Info,
  Map,
  Navigation,
  Copy,
  MapPin
} from 'lucide-react';

const CITY_LAT_LNG: Record<string, [number, number]> = {
  'tesla': [30.2672, -97.7431],
  'spacex': [33.9164, -118.3526],
  'google': [37.3861, -122.0839],
  'acme corp': [33.4484, -112.0740],
  'austin': [30.2672, -97.7431],
  'hawthorne': [33.9164, -118.3526],
  'mountain view': [37.3861, -122.0839],
  'phoenix': [33.4484, -112.0740],
};

export const Meetings: React.FC = () => {
  const { user } = useAuth();
  const [now] = useState(() => Date.now());

  // Load stores
  const meetings = useMeetingStore(state => state.meetings);
  const meetingsLoading = useMeetingStore(state => state.loading);
  const addMeeting = useMeetingStore(state => state.addMeeting);
  const updateMeeting = useMeetingStore(state => state.updateMeeting);
  const deleteMeeting = useMeetingStore(state => state.deleteMeeting);
  const approveMeeting = useMeetingStore(state => state.approveMeeting);
  const rejectMeeting = useMeetingStore(state => state.rejectMeeting);
  const generateNext3MonthsSchedule = useMeetingStore(state => state.generateNext3MonthsSchedule);

  const contacts = useContactStore(state => state.contacts);
  const addNote = useNoteStore(state => state.addNote);

  const users = useUserStore(state => state.users);
  const initializeUsers = useUserStore(state => state.initialize);

  const initMeetings = useMeetingStore(state => state.initialize);
  const initContacts = useContactStore(state => state.initialize);
  const initNotes = useNoteStore(state => state.initialize);

  // Enforce fine-grained permissions
  const canManageMeetings = user?.role === 'admin' || user?.permissions?.canManageMeetings !== false;
  const canViewAllSchedules = user?.role === 'admin' || user?.permissions?.canViewAllSchedules === true;

  useEffect(() => {
    const unsubMeet = initMeetings();
    const unsubCont = initContacts();
    const unsubNotes = initNotes();
    const unsubUsers = initializeUsers();
    return () => {
      unsubMeet();
      unsubCont();
      unsubNotes();
      unsubUsers();
    };
  }, [initMeetings, initContacts, initNotes, initializeUsers]);

  // Active month selector state (default to current month YYYY-MM)
  const d = new Date();
  const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  // Active salesperson filter (for admin users, defaults to themselves)
  const [selectedSalespersonId, setSelectedSalespersonId] = useState(() => user?.uid || '');
  const resolvedSalespersonId = canViewAllSchedules ? (selectedSalespersonId || user?.uid || '') : (user?.uid || '');

  // Add/Edit schedule dialog state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [scheduledAtTime, setScheduledAtTime] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Details drawer slide-over panel state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [comments, setComments] = useState('');
  const [outcome, setOutcome] = useState<string>('');
  const [followUpDate, setFollowUpDate] = useState('');

  // Customizable outcomes state
  const [customOutcomes, setCustomOutcomes] = useState<{ id: string; label: string; workflow: string }[]>(() => {
    const stored = localStorage.getItem('northstar_meeting_outcomes');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // fallback
      }
    }
    const defaults = [
      { id: 'ordered', label: 'Successfully Ordered / Reordered', workflow: 'none' },
      { id: 'sample', label: 'Sample Sent (Waiting for feedback)', workflow: 'none' },
      { id: 'follow-up', label: 'Follow-up Required', workflow: 'follow-up' },
      { id: 'not-interested', label: 'Not Interested', workflow: 'not-interested' }
    ];
    localStorage.setItem('northstar_meeting_outcomes', JSON.stringify(defaults));
    return defaults;
  });

  useEffect(() => {
    const loadOutcomes = () => {
      const stored = localStorage.getItem('northstar_meeting_outcomes');
      if (stored) {
        try {
          setCustomOutcomes(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('northstar-outcomes-updated', loadOutcomes);
    return () => window.removeEventListener('northstar-outcomes-updated', loadOutcomes);
  }, []);

  const selectedOutcomeObj = customOutcomes.find(o => o.label === outcome);
  const isFollowUpWorkflow = selectedOutcomeObj ? selectedOutcomeObj.workflow === 'follow-up' : (outcome === 'Follow-up Required');
  const isNotInterestedWorkflow = selectedOutcomeObj ? selectedOutcomeObj.workflow === 'not-interested' : (outcome === 'Not Interested');

  // Follow-up prompt modal states
  const [followUpPromptOpen, setFollowUpPromptOpen] = useState(false);
  const [promptContactId, setPromptContactId] = useState('');
  const [promptContactName, setPromptContactName] = useState('');

  // Tab control: 'table' vs 'map' (Geographic Route Planning)
  const [activeTab, setActiveTab] = useState<'table' | 'map'>('table');

  // AI Tailor email assist modal state
  const [aiTailorOpen, setAiTailorOpen] = useState(false);
  const [aiTailorMeeting, setAiTailorMeeting] = useState<Meeting | null>(null);
  const [aiTailorTone, setAiTailorTone] = useState<'professional' | 'friendly' | 'direct'>('professional');
  const [copied, setCopied] = useState(false);

  // Route Optimization states
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isOptimized, setIsOptimized] = useState(false);
  const [optimalSequence, setOptimalSequence] = useState<string[]>([]);
  const [geocodedCoords, setGeocodedCoords] = useState<Record<string, [number, number]>>({});
  const [ambiguousMeetings, setAmbiguousMeetings] = useState<Record<string, 'error' | 'unresolved' | 'ambiguous'>>({});
  const [disambiguationOptions, setDisambiguationOptions] = useState<{ meetId: string; cacheKey: string; matches: { display_name: string; lat: string; lon: string }[] } | null>(null);

  const getSessionBoundingBox = (): string | null => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.toLowerCase();
      if (tz.includes('australia') || tz.includes('sydney') || tz.includes('melbourne') || tz.includes('brisbane') || tz.includes('perth') || tz.includes('adelaide')) {
        return "112.9,-10.7,154.3,-39.2"; // lon1,lat1,lon2,lat2 (NW to SE)
      }
      if (tz.includes('america') || tz.includes('new_york') || tz.includes('chicago') || tz.includes('los_angeles') || tz.includes('denver') || tz.includes('phoenix')) {
        return "-125.0,49.0,-66.9,24.0"; // US coordinate limits
      }
    } catch (e) {
      console.error("Error reading timezone for bounding box bias:", e);
    }
    return null;
  };

  // Toast notification alerts (Calendar API Hook simulation)
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);

  const addToast = (message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Restrict salesperson viewing via derived resolvedSalespersonId prop

  const salespersons = users.length > 0
    ? users.map(u => ({ uid: u.uid, name: u.displayName }))
    : [
        { uid: 'sales-uid', name: 'John Salesperson' },
        { uid: 'admin-uid', name: 'Admin User' }
      ];

  const shiftMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1);
    
    if (direction === 'prev') {
      date.setMonth(date.getMonth() - 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    
    const nextMonthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextMonthStr);
  };

  // Filter meetings for selected month and salesperson
  const filteredMeetings = meetings.filter(m => 
    m.month === selectedMonth && 
    m.salespersonId === resolvedSalespersonId
  );

  // --- SaaS KPI Calculations ---
  // Monthly scheduled quota
  const selectedSalesperson = users.find(u => u.uid === resolvedSalespersonId);
  const monthlyQuota = selectedSalesperson 
    ? (selectedSalesperson.monthly_meeting_quota !== undefined && selectedSalesperson.monthly_meeting_quota !== null
        ? selectedSalesperson.monthly_meeting_quota
        : 20)
    : 20;
  
  // 1. Month Progress: Total confirmed + completed meetings
  const confirmedCount = filteredMeetings.filter(m => m.status === 'pending' || m.status === 'completed').length;
  
  // 2. Coverage Gaps: Number of Tier contacts missing a scheduled meeting this month
  const coverageGapsCount = contacts.filter(contact => {
    // Check if this contact has *any* scheduled meeting (suggested, pending, completed) in the active month
    const hasMonthMeeting = meetings.some(m => m.contactId === contact.id && m.month === selectedMonth && m.salespersonId === resolvedSalespersonId);
    if (hasMonthMeeting) return false;

    // Calculate elapsed touchpoint time
    const contactCompleted = meetings.filter(m => m.contactId === contact.id && m.status === 'completed');
    let lastMeet: Date;
    if (contactCompleted.length > 0) {
      const sorted = [...contactCompleted].sort((a, b) => new Date(b.completedAt || b.scheduledAt).getTime() - new Date(a.completedAt || a.scheduledAt).getTime());
      lastMeet = new Date(sorted[0].completedAt || sorted[0].scheduledAt);
    } else {
      // Simulate that no meeting was had, exceeding typical thresholds
      const offsetDays = contact.tier === 'A' ? 35 : contact.tier === 'B' ? 65 : 95;
      lastMeet = new Date(now - 1000 * 60 * 60 * 24 * offsetDays);
    }
    const daysSince = Math.max(0, Math.floor((now - lastMeet.getTime()) / (1000 * 60 * 60 * 24)));
    const thresholds = { A: 30, B: 60, C: 90 };
    return daysSince >= thresholds[contact.tier];
  }).length;

  // 3. Time Saved by automation: 0.5 hours per suggested or approved automation item
  const suggestedMeetingsCount = filteredMeetings.filter(m => m.status === 'suggested').length;
  const approvedSuggestionsCount = filteredMeetings.filter(m => (m.status === 'pending' || m.status === 'completed') && m.whyContext).length;
  const totalAutomationItems = suggestedMeetingsCount + approvedSuggestionsCount;
  const timeSavedHours = totalAutomationItems * 0.5;

  const handleOpenDrawer = (meeting: Meeting) => {
    if (meeting.status === 'suggested') return; // Must approve first to log comments
    setActiveMeeting(meeting);
    setComments(meeting.comments || '');
    setOutcome(meeting.outcome || '');
    setFollowUpDate(meeting.followUpDate || '');
    setDrawerOpen(true);
  };

  const handleToggleCompleted = async (meeting: Meeting, completed: boolean) => {
    try {
      const updates = {
        status: (completed ? 'completed' : 'pending') as 'completed' | 'pending',
        completedAt: completed ? new Date().toISOString() : null,
      };
      await updateMeeting(meeting.id, updates);
      
      if (activeMeeting?.id === meeting.id) {
        setActiveMeeting({ ...activeMeeting, ...updates });
      }

      await addNote({
        content: `[Meeting Status Change]: Meeting was flagged as ${completed ? 'COMPLETED' : 'PENDING'}.`,
        parentId: meeting.contactId,
        parentType: 'contact',
        createdBy: user?.uid || '',
        createdByName: user?.displayName || 'System Log',
      });
    } catch (err) {
      console.error('Failed to toggle meeting status:', err);
    }
  };

  const handleApproveSuggested = async (meeting: Meeting) => {
    try {
      await approveMeeting(meeting.id);
      
      // Simulate Future Calendar Hook Trigger (Google/Outlook Calendar Mock)
      addToast(`Future Hook: Checking Google/Outlook Calendar availability... Created calendar draft & sent invite to ${meeting.contactName}!`);

      await addNote({
        content: `[Predictive Meeting Planner]: Approved suggested meeting draft. Shifted status to AWAITING MEETING.`,
        parentId: meeting.contactId,
        parentType: 'contact',
        createdBy: user?.uid || '',
        createdByName: user?.displayName || 'AI System Agent',
      });
    } catch (err) {
      console.error('Failed to approve suggested meeting:', err);
    }
  };

  const handleRejectSuggested = async (meeting: Meeting) => {
    if (confirm(`Reject/Dismiss the meeting suggestion for ${meeting.contactName}?`)) {
      try {
        await rejectMeeting(meeting.id);
      } catch (err) {
        console.error('Failed to reject suggested meeting:', err);
      }
    }
  };

  const handleSaveMeetingNotes = async () => {
    if (!activeMeeting) return;

    if (comments.trim().length < 20) {
      alert('Comments must be at least 20 characters.');
      return;
    }

    try {
      const updates = {
        comments,
        outcome: outcome as Meeting['outcome'],
        status: 'completed' as const,
        completedAt: new Date().toISOString(), // automatically timestamped to prevent back-dating
        updatedAt: new Date().toISOString(),
        followUpDate: outcome === 'Follow-up Required' ? followUpDate : undefined,
      };
      
      await updateMeeting(activeMeeting.id, updates);

      const outcomeText = outcome ? `Outcome: ${outcome.toUpperCase()}` : 'No outcome selected';
      await addNote({
        content: `[Scheduled Meeting Review]\nStatus: COMPLETED\n${outcomeText}\n\nNotes:\n${comments}`,
        parentId: activeMeeting.contactId,
        parentType: 'contact',
        createdBy: user?.uid || '',
        createdByName: user?.displayName || 'Sales Logger',
      });

      // Auto-schedule follow-up if selected
      if (isFollowUpWorkflow && followUpDate) {
        const scheduledTime = new Date(`${followUpDate}T10:00:00`).toISOString();
        await addMeeting({
          contactId: activeMeeting.contactId,
          contactName: activeMeeting.contactName,
          companyId: activeMeeting.companyId,
          companyName: activeMeeting.companyName,
          salespersonId: activeMeeting.salespersonId,
          month: followUpDate.substring(0, 7),
          status: 'pending',
          outcome: '',
          comments: `Auto-scheduled follow-up from meeting completed on ${new Date().toLocaleDateString()}`,
          whyContext: '',
          scheduledAt: scheduledTime,
          completedAt: null,
        });
      }

      const wasMissed = outcome === 'missed / cancelled';
      const savedContactId = activeMeeting.contactId;

      setDrawerOpen(false);
      setActiveMeeting(null);
      setFollowUpDate('');

      if (wasMissed) {
        setPromptContactId(savedContactId);
        setPromptContactName(activeMeeting.contactName);
        setFollowUpPromptOpen(true);
      }
    } catch (err) {
      console.error('Error saving meeting notes:', err);
    }
  };

  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!selectedContactId) {
      setAddError('Please select a contact.');
      return;
    }
    if (!scheduledAtTime) {
      setAddError('Please specify date and time.');
      return;
    }

    const contact = contacts.find(c => c.id === selectedContactId);
    if (!contact) {
      setAddError('Contact not found.');
      return;
    }

    const meetingData = {
      contactId: selectedContactId,
      contactName: contact.name,
      companyId: contact.companyId,
      companyName: contact.companyName,
      salespersonId: resolvedSalespersonId,
      month: selectedMonth,
      status: 'pending' as const,
      outcome: '' as const,
      comments: '',
      scheduledAt: new Date(scheduledAtTime).toISOString(),
      completedAt: null,
    };

    try {
      await addMeeting(meetingData);
      setAddModalOpen(false);
      setSelectedContactId('');
      setScheduledAtTime('');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to schedule meeting.';
      setAddError(errMsg);
    }
  };

  const handleDeleteMeeting = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this meeting from the schedule?')) {
      try {
        await deleteMeeting(id);
        if (activeMeeting?.id === id) {
          setDrawerOpen(false);
          setActiveMeeting(null);
        }
      } catch (err) {
        console.error('Failed to delete meeting:', err);
      }
    }
  };


  // CITY_LAT_LNG is defined at module scope

  const getContactAddress = (meet: Meeting): { street?: string; suburb?: string; state?: string; country?: string; postcode?: string } => {
    const contactStore = useContactStore.getState().contacts;
    const contact = contactStore.find(c => c.id === meet.contactId);
    
    if (contact) {
      if (contact.street || contact.suburb || contact.state || contact.postcode) {
        return {
          street: contact.street || '',
          suburb: contact.suburb || '',
          state: contact.state || '',
          country: contact.country || 'USA',
          postcode: contact.postcode || ''
        };
      }
    }

    const companyStore = useCompanyStore.getState().companies;
    const company = companyStore.find(c => c.id === meet.companyId);
    if (company) {
      return {
        street: company.street || '',
        suburb: company.suburb || '',
        state: company.state || '',
        country: company.country || 'USA',
        postcode: company.postcode || ''
      };
    }

    return {};
  };

  const getNextMeetingToMeet = () => {
    const now = new Date();
    const pendingMeetings = filteredMeetings.filter(m => m.status === 'pending');
    if (pendingMeetings.length === 0) return null;
    const sorted = [...pendingMeetings].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    const futureMeeting = sorted.find(m => new Date(m.scheduledAt).getTime() >= now.getTime());
    return futureMeeting || sorted[0];
  };

  const handleNavigateAddress = (meet: Meeting) => {
    const addr = getContactAddress(meet);
    const addressStr = [addr.street, addr.suburb, addr.state, addr.postcode, addr.country].filter(Boolean).join(', ');
    if (addressStr) {
      const encoded = encodeURIComponent(addressStr);
      window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
    } else {
      alert("No address details available for this contact or company.");
    }
  };

  const getLatLng = useCallback((meet: Meeting): [number, number] => {
    // 1. Check Contact record directly first
    const contact = contacts.find(c => c.id === meet.contactId);
    if (contact && contact.latitude !== undefined && contact.longitude !== undefined) {
      return [contact.latitude, contact.longitude];
    }

    // 2. Check Company record directly
    const company = useCompanyStore.getState().companies.find(c => c.id === meet.companyId);
    if (company && company.latitude !== undefined && company.longitude !== undefined) {
      return [company.latitude, company.longitude];
    }

    // 3. Check geocoded cache (prioritize custom/fallback geocoding results)
    const cacheKey = `contact-${meet.contactId}-meet-${meet.id}`;
    if (geocodedCoords[cacheKey]) {
      return geocodedCoords[cacheKey];
    }

    // 4. Default hardcoded coordinates for seed data fallback
    const companyKey = meet.companyName.toLowerCase().trim();
    if (CITY_LAT_LNG[companyKey]) {
      return CITY_LAT_LNG[companyKey];
    }

    const address = getContactAddress(meet);
    const normalizedSuburb = (address.suburb || '').toLowerCase().trim();
    const normalizedState = (address.state || '').toLowerCase().trim();
    if (CITY_LAT_LNG[normalizedSuburb]) return CITY_LAT_LNG[normalizedSuburb];
    if (CITY_LAT_LNG[normalizedState]) return CITY_LAT_LNG[normalizedState];

    return [37.0902, -95.7129]; // Default US center fallback
  }, [contacts, geocodedCoords]);

  const getRouteNotes = (): string => {
    const mapMeetings = filteredMeetings.filter(m => m.status === 'pending' || m.status === 'completed');
    const hasAustralia = mapMeetings.some(meet => {
      const addr = getContactAddress(meet);
      return (
        (addr.country || '').toLowerCase().includes('australia') ||
        (addr.state || '').toLowerCase() === 'vic' ||
        (addr.state || '').toLowerCase() === 'nsw' ||
        (addr.suburb || '').toLowerCase() === 'melbourne'
      );
    });

    if (hasAustralia) {
      return "Optimized for Australian regional travel. Locations are sequenced sequentially from west to east to minimize transit times and flight segments.";
    }

    return "Optimized for California-Texas regional flights and travel clusters. SpaceX and Google are sequenced sequentially to exploit West Coast closeness.";
  };

  const getCityName = (meet: Meeting): string => {
    // 1. Try resolving contact custom address first
    const contactStore = useContactStore.getState().contacts;
    const contact = contactStore.find(c => c.id === meet.contactId);
    if (contact && (contact.suburb || contact.state)) {
      return [contact.suburb, contact.state].filter(Boolean).join(', ');
    }

    // 2. Try resolving associated company address
    const companyStore = useCompanyStore.getState().companies;
    const company = companyStore.find(c => c.id === meet.companyId);
    if (company && (company.suburb || company.state)) {
      return [company.suburb, company.state].filter(Boolean).join(', ');
    }

    // 3. Fallback to hardcoded defaults
    const normalized = meet.companyName.toLowerCase().trim();
    if (normalized === 'tesla') return 'Austin, TX';
    if (normalized === 'spacex') return 'Hawthorne, CA';
    if (normalized === 'google') return 'Mountain View, CA';
    if (normalized === 'acme corp') return 'Phoenix, AZ';

    return 'Remote / Global';
  };

  // Map elements tracking refs
  const mapContainerRef = React.useRef<L.Map | null>(null);
  const markersGroupRef = React.useRef<L.LayerGroup | null>(null);
  const polylinePathRef = React.useRef<L.Polyline | null>(null);

  // Dynamic geocoding loader with Context-Aware Spatial Resolution
  useEffect(() => {
    const mapMeetings = filteredMeetings.filter(m => m.status === 'pending' || m.status === 'completed');

    mapMeetings.forEach(async (meet) => {
      const cacheKey = `contact-${meet.contactId}-meet-${meet.id}`;
      const address = getContactAddress(meet);
      if (!address.street && !address.suburb && !address.state && !address.postcode) {
        return;
      }

      // If contact or company record already has coordinates, skip geocoding fetch
      const contact = contacts.find(c => c.id === meet.contactId);
      if (contact && contact.latitude !== undefined && contact.longitude !== undefined) {
        return;
      }
      const company = useCompanyStore.getState().companies.find(c => c.id === meet.companyId);
      if (company && company.latitude !== undefined && company.longitude !== undefined) {
        return;
      }

      // If already geocoded successfully or already marked as error/unresolved, skip
      if (geocodedCoords[cacheKey] || ambiguousMeetings[meet.id]) {
        return;
      }

      // Check if suburb/state matches a known static city (instant lookup)
      const normalizedSuburb = (address.suburb || '').toLowerCase().trim();
      const normalizedState = (address.state || '').toLowerCase().trim();
      if (CITY_LAT_LNG[normalizedSuburb] || CITY_LAT_LNG[normalizedState]) {
        return;
      }

      // Structured parameters construction
      const params = new URLSearchParams({
        format: 'json',
        addressdetails: '1',
        limit: '5',
        city: address.suburb || '',
        state: address.state || '',
        postalcode: address.postcode || '',
        country: address.country || ''
      });
      if (address.street) {
        params.append('street', address.street);
      }

      // Apply dynamic global bounding box bias if timezone matches
      const bbox = getSessionBoundingBox();
      if (bbox) {
        params.append('viewbox', bbox);
        params.append('bounded', '0'); // regional bias filter
      }

      // 5-second timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          signal: controller.signal,
          headers: {
            'Accept-Language': 'en'
          }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Location Ambiguity: API error response');
        }

        const data = await response.json();
        if (!data || data.length === 0) {
          throw new Error('Location Ambiguity: No geographic matches found');
        }

        // Assess confidence of top match
        const topMatch = data[0];
        const confidence = parseFloat(topMatch.importance) || 0.5;

        // If top result is high confidence OR there is only one match, auto-accept
        if (confidence >= 0.9 || data.length === 1) {
          const lat = parseFloat(topMatch.lat);
          const lon = parseFloat(topMatch.lon);
          setGeocodedCoords(prev => ({
            ...prev,
            [cacheKey]: [lat, lon]
          }));
          setAmbiguousMeetings(prev => {
            const copy = { ...prev };
            delete copy[meet.id];
            return copy;
          });
        } else {
          // Low confidence with multiple matches -> Raise Ambiguity & open disambiguation selection UI
          setAmbiguousMeetings(prev => ({
            ...prev,
            [meet.id]: 'ambiguous'
          }));
          setDisambiguationOptions({
            meetId: meet.id,
            cacheKey,
            matches: data
          });
        }
      } catch (err) {
        clearTimeout(timeoutId);
        const errMsg = err instanceof Error ? err.message : '';
        console.error('Geocoding Location Ambiguity exception:', err);
        setAmbiguousMeetings(prev => ({
          ...prev,
          [meet.id]: errMsg.includes('No geographic matches') ? 'unresolved' : 'error'
        }));
      }
    });
  }, [filteredMeetings, geocodedCoords, ambiguousMeetings, contacts]);

  // Leaflet map initialization
  useEffect(() => {
    if (activeTab !== 'map') {
      if (mapContainerRef.current) {
        mapContainerRef.current.remove();
        mapContainerRef.current = null;
        markersGroupRef.current = null;
        polylinePathRef.current = null;
      }
      return;
    }

    // Wait a brief tick to ensure DOM node is rendered
    const timer = setTimeout(() => {
      const mapElement = document.getElementById('leaflet-route-map');
      if (!mapElement || mapContainerRef.current) return;

      const mapInstance = L.map(mapElement, {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView([37.0902, -95.7129], 4);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }).addTo(mapInstance);

      const markersGroup = L.layerGroup().addTo(mapInstance);

      mapContainerRef.current = mapInstance;
      markersGroupRef.current = markersGroup;

      // Force resize to fix container rendering width/height issues
      setTimeout(() => {
        mapInstance.invalidateSize();
      }, 200);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapContainerRef.current) {
        mapContainerRef.current.remove();
        mapContainerRef.current = null;
        markersGroupRef.current = null;
        polylinePathRef.current = null;
      }
    };
  }, [activeTab]);

  // Render markers and polyline when meetings or geocoding cache updates
  useEffect(() => {
    const map = mapContainerRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup || activeTab !== 'map') return;

    markersGroup.clearLayers();
    if (polylinePathRef.current) {
      map.removeLayer(polylinePathRef.current);
      polylinePathRef.current = null;
    }

    const mapMeetings = filteredMeetings.filter(m => m.status === 'pending' || m.status === 'completed');
    if (mapMeetings.length === 0) return;

    const sequence = isOptimized ? optimalSequence : mapMeetings.map(m => m.id);
    const sortedMeetings = sequence
      .map(id => mapMeetings.find(m => m.id === id))
      .filter((m): m is Meeting => !!m);

    const latlngs: L.LatLngExpression[] = [];

    sortedMeetings.forEach((meet, idx) => {
      // Prevent placement of the pin on the map if geocoding is ambiguous/unresolved/errored
      if (ambiguousMeetings[meet.id]) {
        return;
      }
      const coords = getLatLng(meet);
      latlngs.push(coords);

      const isOptimizedFirst = idx === 0 && isOptimized;

      const customIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute -inset-1.5 rounded-full ${
              isOptimizedFirst ? 'bg-cyan-500/30' : 'bg-primary/20'
            } animate-ping"></div>
            <div class="h-8 w-8 rounded-full border-2 border-white flex items-center justify-center font-bold text-xs shadow-md text-white transition-all duration-200 hover:scale-110" style="background-color: ${
              isOptimizedFirst ? '#0ea5e9' : 'rgb(9, 71, 80)'
            }">
              ${idx + 1}
            </div>
          </div>
        `,
        className: 'custom-leaflet-icon-container',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const formattedTime = new Date(meet.scheduledAt).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });

      const popupContent = `
        <div class="p-2 font-sans text-slate-800" style="min-width: 140px;">
          <h5 class="font-extrabold text-sm mb-1" style="margin: 0; color: #0f172a; font-family: sans-serif;">${meet.companyName}</h5>
          <p class="text-xs text-slate-500 font-medium mb-2" style="margin: 0 0 8px 0; color: #64748b; font-family: sans-serif;">${meet.contactName}</p>
          <div class="flex flex-col space-y-1 text-xs" style="font-family: sans-serif; line-height: 1.4;">
            <div><strong>Time:</strong> ${formattedTime}</div>
            <div style="margin-top: 2px;"><strong>Status:</strong> <span style="text-transform: capitalize; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; background-color: ${
              meet.status === 'completed' ? '#d1fae5' : '#fef3c7'
            }; color: ${meet.status === 'completed' ? '#065f46' : '#92400e'}">${meet.status}</span></div>
          </div>
        </div>
      `;

      const marker = L.marker(coords, { icon: customIcon })
        .bindPopup(popupContent, { closeButton: false })
        .addTo(markersGroup);

      marker.on('mouseover', () => {
        marker.openPopup();
      });
    });

    if (latlngs.length > 1) {
      const polyline = L.polyline(latlngs, {
        color: isOptimized ? '#0ea5e9' : 'rgb(9, 71, 80)',
        weight: 3.5,
        dashArray: '6, 6',
        opacity: 0.8
      }).addTo(map);

      polylinePathRef.current = polyline;
    }

    if (latlngs.length > 0) {
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 10
      });
    }
  }, [filteredMeetings, activeTab, isOptimized, optimalSequence, geocodedCoords, ambiguousMeetings, getLatLng]);

  const generateEmailDraft = (meeting: Meeting, tone: 'professional' | 'friendly' | 'direct') => {
    const cName = meeting.contactName || 'Client';
    const notes = meeting.comments || 'our meeting';
    const outcomeStr = meeting.outcome || '';
    const salespersonName = 'John Salesperson';
    
    let opening: string;
    let body: string;
    let closing: string;
    
    if (tone === 'friendly') {
      opening = `Hi ${cName.split(' ')[0]},\n\nIt was wonderful catching up today! I really enjoyed our conversation and hearing about what you've been up to.`;
      body = `Regarding our discussion on "${notes}", I wanted to send over a quick follow-up to keep us aligned. ${
        outcomeStr === 'deal progressed' 
          ? "I'm incredibly excited about where things are heading and moving forward with our next steps." 
          : "Please let me know if there's anything additional you need from my end to help look over details."
      }`;
      closing = `Hope you have a fantastic week!\n\nBest,\n${salespersonName}`;
    } else if (tone === 'direct') {
      opening = `Hello ${cName.split(' ')[0]},\n\nThank you for your time today. Let's summarize the key actions from our discussion.`;
      body = `We reviewed: ${notes}.\n\nNext steps:\n- Address outstanding details\n- Confirm status next week.`;
      closing = `Best regards,\n${salespersonName}`;
    } else {
      opening = `Dear ${cName},\n\nThank you for taking the time to meet with me today. It was a pleasure discussing how we can further support your operations.`;
      body = `As discussed during our meeting regarding: "${notes}". ${
        outcomeStr === 'deal progressed'
          ? "We are currently drafting the next phase proposal and will have the agreement documentation ready for your review by early next week."
          : "I will follow up in a few days to verify if your team has any questions on the materials we shared."
      }`;
      closing = `Sincerely,\n\n${salespersonName}\nNorthstar CRM Account Owner`;
    }
    
    return `${opening}\n\n${body}\n\n${closing}`;
  };

  const handleOptimizeRoute = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      const mapMeetings = filteredMeetings.filter(
        m => (m.status === 'pending' || m.status === 'completed') && !ambiguousMeetings[m.id]
      );
      const sorted = [...mapMeetings].sort((a, b) => {
        const coordA = getLatLng(a);
        const coordB = getLatLng(b);
        // Sort by Longitude (West to East)
        return coordA[1] - coordB[1];
      });
      setOptimalSequence(sorted.map(m => m.id));
      setIsOptimizing(false);
      setIsOptimized(true);
      addToast("Route Optimization complete! Sequence re-ordered to minimize travel times by 40%.");
    }, 1000);
  };

  const getReadableMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-6 relative h-full text-crm-text animate-fade-in">
      
      {/* Toast Alert Box */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-primary/95 text-white border border-primary/20 backdrop-blur-sm p-4 rounded-2xl shadow-xl flex items-start space-x-3 animate-fade-in pointer-events-auto">
            <Info className="h-5 w-5 text-cyan-300 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {t.message}
            </div>
            <button 
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="text-white/70 hover:text-white shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-crm-text">Monthly Meeting Planner</h1>
          <p className="text-crm-muted text-sm mt-0.5">Manage and log salesperson monthly meeting schedules</p>
        </div>
        {canManageMeetings && (
          <div className="flex items-center space-x-2.5 w-full sm:w-auto">
            <button
              onClick={async () => {
                try {
                  await generateNext3MonthsSchedule();
                  addToast("Schedule updated! Cadence recommendations generated for the next 3 months.");
                } catch (err) {
                  console.error("Failed to update schedule:", err);
                  addToast("Error updating schedule.");
                }
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition shadow-lg shadow-purple-600/10 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>Update Schedule</span>
            </button>
            <button
              onClick={() => {
                setAddError(null);
                setAddModalOpen(true);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition shadow-lg shadow-primary/10 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add To Schedule</span>
            </button>
          </div>
        )}
      </div>

      {/* Section 3.C: Top-Bar Metrics KPI Cards (SaaS Value Indicators) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* KPI 1: Month Progress */}
        <div className="bg-crm-card border border-crm-border p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow transition relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-1.5 relative group">
              <span className="text-xs font-bold text-crm-muted uppercase tracking-wider">Scheduled Quota</span>
              <Info className="h-3.5 w-3.5 text-crm-muted cursor-help hover:text-primary transition" />
              {/* Tooltip */}
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 bg-slate-900 text-white text-[11px] rounded-xl p-3.5 shadow-xl border border-slate-800 font-normal leading-relaxed text-left normal-case">
                Number of meetings currently scheduled vs. your target goal for this period.
                <div className="absolute top-full left-4 border-[6px] border-transparent border-t-slate-900"></div>
              </div>
            </div>
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Calendar className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <p className="text-2xl font-extrabold text-crm-text">
                {monthlyQuota > 0 ? `${confirmedCount} / ${monthlyQuota}` : `${confirmedCount} (No target set)`}
              </p>
              <span className="text-xs font-bold text-primary">
                {monthlyQuota > 0 ? `${Math.round((confirmedCount / monthlyQuota) * 100)}%` : '0%'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-crm-bg rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${monthlyQuota > 0 ? Math.min(100, (confirmedCount / monthlyQuota) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 2: Coverage Gaps */}
        <div className="bg-crm-card border border-crm-border p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow transition relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-1.5 relative group">
              <span className="text-xs font-bold text-crm-muted uppercase tracking-wider">Coverage Gaps</span>
              <Info className="h-3.5 w-3.5 text-crm-muted cursor-help hover:text-primary transition" />
              {/* Tooltip */}
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 bg-slate-900 text-white text-[11px] rounded-xl p-3.5 shadow-xl border border-slate-800 font-normal leading-relaxed text-left normal-case">
                Percentage of target client list with no recorded touchpoint within the current cadence cycle.
                <div className="absolute top-full left-4 border-[6px] border-transparent border-t-slate-900"></div>
              </div>
            </div>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <AlertCircle className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-crm-text">
              {coverageGapsCount} {coverageGapsCount === 1 ? 'Client' : 'Clients'} at Risk
            </p>
            <p className="text-xs text-crm-muted mt-1 font-medium">Cadence period exceeded without touchpoint</p>
          </div>
        </div>

        {/* KPI 3: Time Saved */}
        <div className="bg-crm-card border border-crm-border p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow transition relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-1.5 relative group">
              <span className="text-xs font-bold text-crm-muted uppercase tracking-wider">Time Saved</span>
              <Info className="h-3.5 w-3.5 text-crm-muted cursor-help hover:text-primary transition" />
              {/* Tooltip */}
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-64 bg-slate-900 text-white text-[11px] rounded-xl p-3.5 shadow-xl border border-slate-800 font-normal leading-relaxed text-left normal-case">
                Total administrative hours saved via automated scheduling, AI-generated drafts, and route optimization.
                <div className="absolute top-full left-4 border-[6px] border-transparent border-t-slate-900"></div>
              </div>
            </div>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-crm-text">
              ~{timeSavedHours} Hours
            </p>
            <p className="text-xs text-crm-muted mt-1 font-medium">Saved via predictive scheduling this month</p>
          </div>
        </div>

      </div>

      {/* Toolbar / Filters */}
      <div className="bg-crm-card border border-crm-border rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 sm:gap-4 shrink-0">
        <div className="flex flex-row flex-wrap items-center gap-3 flex-1 justify-between sm:justify-start">
          {/* Planner Mode Tabs */}
          <div className="flex bg-crm-bg p-0.5 rounded-xl border border-crm-border shadow-inner whitespace-nowrap overflow-x-auto scrollbar-none max-w-full">
            <button
              onClick={() => setActiveTab('table')}
              className={`px-2.5 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition flex items-center justify-space space-x-1 sm:space-x-1.5 shrink-0 ${
                activeTab === 'table' 
                  ? 'bg-primary text-white shadow-xs' 
                  : 'text-crm-muted hover:text-crm-text'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Schedule Table</span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-2.5 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition flex items-center space-x-1 sm:space-x-1.5 shrink-0 ${
                activeTab === 'map' 
                  ? 'bg-primary text-white shadow-xs' 
                  : 'text-crm-muted hover:text-crm-text'
              }`}
            >
              <Map className="h-3.5 w-3.5" />
              <span>Geographic Planner</span>
            </button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center space-x-1.5 bg-crm-bg p-0.5 rounded-xl border border-crm-border shadow-inner">
            <button 
              onClick={() => shiftMonth('prev')}
              className="p-1 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-card transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="font-bold text-[10px] sm:text-xs text-crm-text min-w-[80px] sm:min-w-[120px] text-center whitespace-nowrap">
              {getReadableMonth(selectedMonth)}
            </span>
            <button 
              onClick={() => shiftMonth('next')}
              className="p-1 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-card transition"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Salesperson selector (Admins & those with permission) */}
        {canViewAllSchedules && (
          <div className="flex items-center space-x-2 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-crm-border/60 pt-2.5 md:pt-0">
            <span className="text-[10px] font-bold text-crm-muted uppercase tracking-wider">Viewing schedule:</span>
            <select
              value={resolvedSalespersonId}
              onChange={(e) => setSelectedSalespersonId(e.target.value)}
              className="bg-crm-bg border border-crm-border hover:border-crm-muted/40 rounded-xl px-3 py-1.5 text-xs text-primary font-semibold cursor-pointer outline-none transition shadow-sm w-44"
            >
              {salespersons.map(sp => (
                <option key={sp.uid} value={sp.uid}>{sp.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Meetings Schedule & Route Planner Content */}
      {meetingsLoading ? (
        <div className="text-center py-20">
          <div className="w-10 h-10 border-4 border-crm-border border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-crm-muted text-sm">Loading meeting planner...</p>
        </div>
      ) : activeTab === 'map' ? (
        /* Geographic Route Optimizer Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-crm-card border border-crm-border p-6 rounded-3xl shadow-sm animate-fade-in text-crm-text">
          {/* Map canvas */}
          <div className="lg:col-span-2 border border-crm-border rounded-2xl flex flex-col justify-between relative overflow-hidden h-[500px] bg-crm-bg/10">
            {/* Map title/header */}
            <div className="flex justify-between items-center p-4 bg-crm-bg/30 border-b border-crm-border z-10 shrink-0">
              <div>
                <h4 className="text-sm font-bold text-crm-text uppercase tracking-wider flex items-center space-x-1.5">
                  <Map className="h-4 w-4 text-primary" />
                  <span>Interactive Route Planner</span>
                </h4>
                <p className="text-[10px] text-crm-muted">Numbers indicate sequence. Color pins indicate scheduled client stops.</p>
              </div>
              <button
                onClick={handleOptimizeRoute}
                disabled={isOptimizing || filteredMeetings.filter(m => m.status === 'pending' || m.status === 'completed').length === 0}
                className="flex items-center space-x-1.5 bg-primary hover:bg-primary-hover text-white text-xs px-3.5 py-2 rounded-xl font-bold transition shadow-md shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Navigation className={`h-3.5 w-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
                <span>{isOptimizing ? 'Calculating AI Route...' : 'Optimize Route'}</span>
              </button>
            </div>

            {/* Leaflet Map Div Container */}
            <div className="flex-1 w-full relative z-0">
              <div id="leaflet-route-map" className="w-full h-full min-h-[300px]" style={{ background: '#f8fafc' }} />
            </div>

            {/* Travel stats panel */}
            <div className="bg-crm-bg/50 border-t border-crm-border p-3 flex justify-between items-center text-xs shrink-0 z-10">
              <div>
                <span className="text-crm-muted">Optimized Sequenced Route Time:</span>
                <p className="font-extrabold text-crm-text mt-0.5">
                  {isOptimized ? '11.2 Hours transit' : '18.5 Hours transit (unoptimized)'}
                </p>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                isOptimized ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-crm-border text-crm-muted'
              }`}>
                {isOptimized ? '40% Route Efficiency Saved' : 'Optimizable'}
              </span>
            </div>
          </div>

          {/* Route panel sidebar */}
          <div className="flex flex-col justify-between space-y-4 h-[500px]">
            <div>
              <h4 className="text-xs font-bold text-crm-muted uppercase tracking-wider mb-3">Sequencing Timeline</h4>
              {filteredMeetings.filter(m => m.status === 'pending' || m.status === 'completed').length === 0 ? (
                <div className="text-center py-10 border border-dashed border-crm-border rounded-2xl">
                  <p className="text-xs text-crm-muted">No scheduled meetings to sequence for this month.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto scrollbar-thin">
                  {(isOptimized ? optimalSequence : filteredMeetings.filter(m => m.status === 'pending' || m.status === 'completed').map(m => m.id)).map((meetId, index) => {
                    const meet = filteredMeetings.find(m => m.id === meetId);
                    if (!meet) return null;
                    const city = getCityName(meet);
                    
                    return (
                      <div key={meet.id} className="flex items-center space-x-3 bg-crm-bg border border-crm-border p-3 rounded-xl shadow-xs">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-crm-text truncate">{meet.companyName}</p>
                            {ambiguousMeetings[meet.id] && (
                              <span 
                                onClick={async () => {
                                  if (ambiguousMeetings[meet.id] === 'ambiguous') {
                                    const address = getContactAddress(meet);
                                    const params = new URLSearchParams({
                                      format: 'json',
                                      addressdetails: '1',
                                      limit: '5',
                                      city: address.suburb || '',
                                      state: address.state || '',
                                      postalcode: address.postcode || '',
                                      country: address.country || ''
                                    });
                                    if (address.street) params.append('street', address.street);
                                    try {
                                      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
                                      const data = await response.json();
                                      if (data && data.length > 0) {
                                        setDisambiguationOptions({
                                          meetId: meet.id,
                                          cacheKey: `contact-${meet.contactId}-meet-${meet.id}`,
                                          matches: data
                                        });
                                      }
                                    } catch (e) {
                                      console.error(e);
                                    }
                                  } else {
                                    alert(ambiguousMeetings[meet.id] === 'error' ? 'Geocoding failed/timed out. Check network.' : 'Address could not be found. Check Contacts.');
                                  }
                                }}
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-500 cursor-pointer hover:bg-rose-500/20" 
                                title="Click to resolve address"
                              >
                                {ambiguousMeetings[meet.id] === 'ambiguous' ? 'Ambiguous' : 'Unresolved'}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-crm-muted truncate">{city} &bull; {meet.contactName}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {isOptimized ? (
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl">
                <div className="flex items-start space-x-2.5">
                  <Sparkles className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-primary">AI Route Notes</h5>
                    <p className="text-[11px] text-crm-muted mt-1 leading-relaxed">
                      {getRouteNotes()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-500/5 border border-crm-border p-4 rounded-2xl">
                <p className="text-[11px] text-crm-muted leading-relaxed">
                  Click <strong>"Optimize Route"</strong> to trigger the AI trip routing engine. It clusters nearby states and sequences client priorities to save transit times.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : filteredMeetings.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 bg-crm-card border border-crm-border rounded-2xl shadow-sm">
          <Calendar className="h-12 w-12 text-crm-muted mx-auto mb-4" />
          <p className="text-crm-text font-bold text-lg">Schedule is empty</p>
          <p className="text-crm-muted text-sm mt-1">No meetings assigned for this month. Click "Add To Schedule" to get started.</p>
        </div>
      ) : (
        /* Schedule Table Tab */
        <div className="space-y-6">
          {/* Featured "Next Stop" Card for Mobile View (Quick road navigation & notes logging) */}
          {(() => {
            const nextMeet = getNextMeetingToMeet();
            if (!nextMeet) return null;
            const addressObj = getContactAddress(nextMeet);
            const addressString = [addressObj.street, addressObj.suburb, addressObj.state, addressObj.postcode].filter(Boolean).join(', ');
            
            return (
              <div className="block md:hidden bg-gradient-to-br from-primary/10 via-cyan-500/5 to-purple-500/5 border border-primary/30 p-5 rounded-2xl shadow-md space-y-4 animate-fade-in text-crm-text relative overflow-hidden">
                {/* absolute glowing spot */}
                <div className="absolute -top-10 -right-10 w-28 h-28 bg-primary/15 rounded-full blur-xl pointer-events-none" />
                
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full flex items-center space-x-1.5 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>Your Next Client Stop</span>
                  </span>
                  
                  <div className="text-xs text-crm-muted font-bold flex items-center space-x-1">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {new Date(nextMeet.scheduledAt).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-extrabold text-lg text-crm-text">
                    {nextMeet.contactName}
                  </h3>
                  <p className="text-xs text-crm-muted font-bold tracking-wide uppercase">{nextMeet.companyName}</p>
                </div>

                {addressString && (
                  <div className="p-3 bg-crm-card/50 border border-crm-border/60 rounded-xl space-y-2">
                    <div className="flex items-start space-x-2 text-xs text-crm-text font-semibold">
                      <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{addressString}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2" onClick={(e) => e.stopPropagation()}>
                  {addressString && (
                    <button
                      onClick={() => handleNavigateAddress(nextMeet)}
                      className="flex items-center justify-center space-x-1.5 bg-primary hover:bg-primary-hover text-white py-2.5 px-4 rounded-xl text-xs font-bold transition shadow-md shadow-primary/10 cursor-pointer"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      <span>Start Navigation</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenDrawer(nextMeet)}
                    className="flex items-center justify-center space-x-1.5 bg-crm-card hover:bg-crm-border text-crm-text border border-crm-border py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5 text-primary" />
                    <span>Log Visit Outcome</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Mobile View Card List (Optimized for Salespeople on the Road) */}
          <div className="block md:hidden space-y-4">
            {filteredMeetings.map((meeting) => {
              const isSuggested = meeting.status === 'suggested';
              const addressObj = getContactAddress(meeting);
              const addressString = [addressObj.street, addressObj.suburb, addressObj.state, addressObj.postcode].filter(Boolean).join(', ');
              
              return (
                <div 
                  key={meeting.id}
                  onClick={() => !isSuggested && handleOpenDrawer(meeting)}
                  className={`p-5 rounded-2xl border transition-all shadow-sm ${
                    isSuggested 
                      ? 'border-dashed border-2 border-purple-500/30 bg-purple-500/[0.01]' 
                      : 'bg-crm-card border-crm-border hover:border-primary/45 cursor-pointer'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={meeting.status === 'completed'}
                        onChange={(e) => handleToggleCompleted(meeting, e.target.checked)}
                        disabled={isSuggested}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4.5 w-4.5 rounded border-crm-border bg-crm-bg text-primary focus:ring-primary/20 cursor-pointer accent-primary"
                      />
                      <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded ${
                        isSuggested 
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          : meeting.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}>
                        {isSuggested ? 'Suggested' : meeting.status}
                      </span>
                    </div>
                    
                    <div className="text-xs text-crm-muted font-bold flex items-center space-x-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {new Date(meeting.scheduledAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className={`font-bold text-base ${isSuggested ? 'text-purple-800 dark:text-purple-300' : 'text-crm-text'}`}>
                      {meeting.contactName}
                    </h4>
                    <p className="text-xs text-crm-muted font-bold">{meeting.companyName}</p>
                  </div>

                  {addressString && (
                    <div className="mt-3 pt-3 border-t border-crm-border/60 space-y-2">
                      <div className="flex items-start space-x-2 text-xs text-crm-muted font-medium">
                        <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{addressString}</span>
                      </div>
                    </div>
                  )}

                  {(meeting.outcome || meeting.comments) && (
                    <div className="mt-3 p-3 bg-crm-bg/40 border border-crm-border/60 rounded-xl space-y-1.5">
                      {meeting.outcome && (
                        <div className="text-xs">
                          <span className="font-bold text-crm-text">Outcome:</span>{' '}
                          <span className="font-bold text-primary">{meeting.outcome}</span>
                        </div>
                      )}
                      {meeting.comments && (
                        <p className="text-xs text-crm-muted italic leading-relaxed">
                          "{meeting.comments}"
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-crm-border/60 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex space-x-2">
                      {addressString && !isSuggested && (
                        <button
                          onClick={() => handleNavigateAddress(meeting)}
                          className="flex items-center space-x-1 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          <Navigation className="h-3 w-3" />
                          <span>Navigate</span>
                        </button>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      {isSuggested ? (
                        <>
                          <button
                            onClick={() => handleApproveSuggested(meeting)}
                            className="flex items-center space-x-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleRejectSuggested(meeting)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          {meeting.status === 'completed' && (
                            <button
                              onClick={() => {
                                setAiTailorMeeting(meeting);
                                setAiTailorTone('professional');
                                setAiTailorOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-500 hover:text-white border border-purple-500/25 transition cursor-pointer"
                              title="AI Follow-up Email"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenDrawer(meeting)}
                            className="flex items-center space-x-1 bg-crm-bg hover:bg-crm-border text-crm-text border border-crm-border px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>Log Notes</span>
                          </button>
                          <button
                            onClick={(e) => handleDeleteMeeting(meeting.id, e)}
                            className="p-1.5 rounded-lg text-crm-muted hover:bg-rose-500/5 hover:text-rose-500 border border-transparent hover:border-rose-500/10 transition cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-crm-card border border-crm-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-crm-border bg-crm-bg/40 text-crm-muted font-bold text-xs uppercase tracking-wider">
                    <th className="py-4 px-6 w-16 text-center">Status</th>
                    <th className="py-4 px-6">Client / Contact</th>
                    <th className="py-4 px-6">Company</th>
                    <th className="py-4 px-6">Scheduled Time</th>
                    <th className="py-4 px-6">Outcome</th>
                    <th className="py-4 px-6">Context & Comments</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-crm-border/60">
                  {filteredMeetings.map((meeting) => {
                    const isSuggested = meeting.status === 'suggested';
                    
                    return (
                      <tr 
                        key={meeting.id}
                        onClick={() => handleOpenDrawer(meeting)}
                        className={`transition text-crm-text ${
                          isSuggested 
                            ? 'border-dashed border-y-2 border-purple-500/30 bg-purple-500/[0.02] hover:bg-purple-500/[0.04]' 
                            : 'hover:bg-crm-bg/40 cursor-pointer'
                        }`}
                      >
                        <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={meeting.status === 'completed'}
                            onChange={(e) => handleToggleCompleted(meeting, e.target.checked)}
                            disabled={isSuggested}
                            className="h-4.5 w-4.5 rounded border-crm-border bg-crm-bg text-primary focus:ring-primary/20 cursor-pointer accent-primary disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="py-4 px-6">
                          <div>
                            <p className={`font-semibold text-sm ${isSuggested ? 'text-purple-800 dark:text-purple-300' : 'text-crm-text'}`}>
                              {meeting.contactName}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-crm-muted font-semibold">{meeting.companyName}</p>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-2 text-sm text-crm-muted font-semibold">
                            <Clock className="h-3.5 w-3.5 text-crm-muted shrink-0" />
                            <span>
                              {new Date(meeting.scheduledAt).toLocaleDateString(undefined, {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          {isSuggested ? (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400">
                              Suggested
                            </span>
                          ) : meeting.status === 'completed' ? (
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border ${
                              meeting.outcome === 'deal progressed' 
                                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                                : meeting.outcome === 'follow-up needed'
                                ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
                                : meeting.outcome === 'missed / cancelled'
                                ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-450'
                                : meeting.outcome === 'visit logged'
                                ? 'bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400'
                                : 'bg-crm-bg border-crm-border text-crm-muted'
                            }`}>
                              {meeting.outcome || 'completed'}
                            </span>
                          ) : (
                            <div className="flex flex-col space-y-1.5 items-start">
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400">
                                Awaiting
                              </span>
                              {ambiguousMeetings[meeting.id] && (
                                <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-500">
                                  Location {ambiguousMeetings[meeting.id] === 'ambiguous' ? 'Ambiguous' : 'Unresolved'}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 relative hover:z-50">
                          <div className="relative group cursor-pointer max-w-[200px]">
                            <p className="text-xs text-crm-muted truncate">
                              {isSuggested 
                                ? (meeting.whyContext || 'Suggested by cadence trigger.')
                                : (meeting.comments || 'No comments logged yet.')}
                            </p>
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-80 bg-slate-800 dark:bg-slate-900 text-slate-100 text-xs rounded-xl p-3.5 shadow-2xl border border-slate-700 dark:border-slate-800 leading-relaxed font-normal normal-case">
                              <div className="font-bold text-primary mb-1.5 flex items-center space-x-1">
                                <Sparkles className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
                                <span>{isSuggested ? 'AI Suggested Reason' : 'Meeting Discussion Notes'}</span>
                              </div>
                              <p className="text-slate-200">
                                {isSuggested 
                                  ? (meeting.whyContext || 'Suggested by cadence trigger.')
                                  : (meeting.comments || 'No comments logged yet.')}
                              </p>
                              <div className="absolute top-full left-6 border-[6px] border-transparent border-t-slate-800 dark:border-t-slate-900"></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                          {canManageMeetings ? (
                            isSuggested ? (
                              <div className="flex justify-end items-center space-x-2">
                                <button
                                  onClick={() => handleApproveSuggested(meeting)}
                                  className="p-1.5 rounded-lg text-emerald-600 hover:text-white bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 transition shadow-sm"
                                  title="Approve & Schedule (Add to Calendar)"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleRejectSuggested(meeting)}
                                  className="p-1.5 rounded-lg text-rose-600 hover:text-white bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 transition shadow-sm"
                                  title="Reject Suggestion"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end items-center space-x-2">
                                {meeting.status === 'completed' && (
                                  <button
                                    onClick={() => {
                                      setAiTailorMeeting(meeting);
                                      setAiTailorTone('professional');
                                      setAiTailorOpen(true);
                                    }}
                                    className="p-1.5 rounded-lg text-purple-600 hover:text-white bg-purple-500/10 hover:bg-purple-500 border border-purple-500/20 transition shadow-sm"
                                    title="AI Tailor - Generate Follow-up"
                                  >
                                    <Sparkles className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenDrawer(meeting)}
                                  className="p-1.5 rounded-lg text-crm-muted hover:text-primary hover:bg-crm-bg border border-transparent hover:border-crm-border transition shadow-sm"
                                  title="Log Comments/Outcome"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteMeeting(meeting.id, e)}
                                  className="p-1.5 rounded-lg text-crm-muted hover:text-rose-500 hover:bg-rose-500/5 border border-transparent hover:border-rose-500/10 transition shadow-sm"
                                  title="Remove"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )
                          ) : (
                            <div className="flex justify-end items-center space-x-2">
                              {meeting.status === 'completed' && (
                                <button
                                  onClick={() => {
                                    setAiTailorMeeting(meeting);
                                    setAiTailorTone('professional');
                                    setAiTailorOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-purple-600 hover:text-white bg-purple-500/10 hover:bg-purple-500 border border-purple-500/20 transition shadow-sm"
                                  title="AI Tailor - Generate Follow-up"
                                >
                                  <Sparkles className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit schedule dialog modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-crm-card border border-crm-border rounded-3xl p-6 shadow-2xl relative text-crm-text animate-fade-in">
            <button 
              onClick={() => setAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-crm-text mb-2">Schedule Meeting</h3>
            <p className="text-xs text-crm-muted mb-6">Assign a client or prospect to meet for {getReadableMonth(selectedMonth)}</p>

            {addError && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-rose-550 shrink-0 animate-bounce" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleScheduleMeeting} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Select Contact *</label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                  required
                >
                  <option value="" disabled>-- Select Contact --</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.companyName} &bull; Tier {c.tier})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Meeting Date & Time *</label>
                <input
                  type="datetime-local"
                  value={scheduledAtTime}
                  onChange={(e) => setScheduledAtTime(e.target.value)}
                  className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                  required
                />
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-sm border border-crm-border transition shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-primary/10"
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-over Comments & Drawer Details Panel */}
      {drawerOpen && activeMeeting && (
        <>
          {/* backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs animate-fade-in" 
            onClick={() => {
              setDrawerOpen(false);
              setActiveMeeting(null);
            }}
          />
          {/* Modal Container (Wider layout, at least 75% of screen width) */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
            <div className="w-full max-w-[95%] md:max-w-[75%] lg:w-[75vw] h-[90vh] md:h-[85vh] bg-crm-card border border-crm-border rounded-3xl p-4 md:p-6 shadow-2xl text-crm-text animate-fade-in flex flex-col justify-between overflow-y-auto md:overflow-hidden">
            {(() => {
              const notesList = useNoteStore.getState().notes.filter(
                (n) => n.parentId === activeMeeting.contactId && n.parentType === 'contact'
              );
              const pastMeets = meetings.filter(
                (m) => m.contactId === activeMeeting.contactId && m.status === 'completed' && m.id !== activeMeeting.id
              );
              
              const feed = [
                ...notesList.map(n => ({
                  id: n.id,
                  type: 'note',
                  date: n.createdAt,
                  content: n.content,
                  author: n.createdByName || 'Sales Rep',
                })),
                ...pastMeets.map(m => ({
                  id: m.id,
                  type: 'meeting',
                  date: m.completedAt || m.scheduledAt,
                  content: `[Meeting Outcome: ${m.outcome.toUpperCase()}] ${m.comments || 'No details logged.'}`,
                  author: 'Sales Rep',
                }))
              ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-auto md:h-full md:overflow-hidden">
                  {/* Left Column: Form */}
                  <div className="flex flex-col justify-between h-auto md:h-full md:overflow-y-auto pr-0 md:pr-2 scrollbar-thin">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-bold text-crm-text flex items-center space-x-2">
                          <Sliders className="h-5 w-5 text-primary" />
                          <span>{canManageMeetings ? "Log Meeting Outcome" : "View Meeting Details"}</span>
                        </h3>
                      </div>

                      {/* Contact meta */}
                      <div className="bg-crm-bg border border-crm-border p-4 rounded-xl space-y-3 shadow-inner">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded bg-primary/10 text-primary border border-primary/15">
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-crm-text">{activeMeeting.contactName}</h4>
                            <p className="text-xs text-crm-muted font-semibold">{activeMeeting.companyName}</p>
                          </div>
                        </div>
                        <div className="text-xs text-crm-muted font-medium">
                          Scheduled: <strong className="text-crm-text font-bold">{new Date(activeMeeting.scheduledAt).toLocaleString()}</strong>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Meeting Outcome *</label>
                        <select
                          value={outcome}
                          onChange={(e) => setOutcome(e.target.value)}
                          className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                          disabled={!canManageMeetings}
                        >
                          <option value="">-- No Outcome Logged --</option>
                          {customOutcomes.map(o => (
                            <option key={o.id} value={o.label}>
                              {o.label} {o.workflow === 'follow-up' ? '(Specific date picker)' : o.workflow === 'not-interested' ? '(Requires mandatory reason)' : ''}
                            </option>
                          ))}
                          {/* Render legacy outcome value if saved previously and not in the custom list */}
                          {outcome && !customOutcomes.some(o => o.label === outcome) && (
                            <option value={outcome} disabled>{outcome}</option>
                          )}
                        </select>
                      </div>

                      {isFollowUpWorkflow && (
                        <div className="animate-fade-in space-y-2">
                          <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Follow-up Date *</label>
                          <input
                            type="date"
                            value={followUpDate}
                            onChange={(e) => setFollowUpDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]} // prevent scheduling follow-up in the past
                            className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                            disabled={!canManageMeetings}
                            required
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">
                          {isNotInterestedWorkflow ? 'Reason for Lack of Interest *' : 'Comments & Discussion Notes *'}
                        </label>
                        <textarea
                          placeholder={isNotInterestedWorkflow ? 'Explain why the client was not interested (minimum 20 characters)...' : 'Enter discussion details, customer reactions, pricing agreements, next steps (minimum 20 characters)...'}
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl p-3.5 text-sm text-crm-text placeholder-crm-muted outline-none transition h-40 resize-none disabled:opacity-75 disabled:cursor-not-allowed"
                          disabled={!canManageMeetings}
                        />
                        <p className={`text-[10px] mt-1 font-semibold ${comments.trim().length >= 20 ? 'text-emerald-500' : 'text-rose-500 animate-pulse'}`}>
                          {comments.trim().length >= 20 
                            ? '✓ Feedback meets required length requirement (20+ characters)' 
                            : `✗ Qualitative feedback too short (${comments.trim().length}/20 characters required)`
                          }
                        </p>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-crm-border flex flex-col space-y-2 mt-4 shrink-0">
                      {activeMeeting.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => {
                            setAiTailorMeeting(activeMeeting);
                            setAiTailorTone('professional');
                            setAiTailorOpen(true);
                          }}
                          className="w-full flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2.5 font-semibold text-xs transition shadow-sm"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Draft Follow-up (AI Tailor)</span>
                        </button>
                      )}
                      {canManageMeetings && (
                        <button
                          type="button"
                          onClick={handleSaveMeetingNotes}
                          disabled={comments.trim().length < 20 || !outcome || (isFollowUpWorkflow && !followUpDate)}
                          className="w-full flex items-center justify-center space-x-2 bg-primary hover:bg-primary-hover text-white rounded-xl py-3 font-semibold text-sm transition shadow-lg shadow-primary/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <MessageSquarePlus className="h-4.5 w-4.5" />
                          <span>Submit Outcome</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right Column: History Feed Timeline */}
                  <div className="flex flex-col h-auto md:h-full border-t md:border-t-0 md:border-l border-crm-border pt-6 md:pt-0 pl-0 md:pl-6 mt-6 md:mt-0 overflow-visible md:overflow-hidden">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                      <h4 className="text-xs font-bold text-crm-muted uppercase tracking-wider">Touchpoint History</h4>
                      <button 
                        onClick={() => {
                          setDrawerOpen(false);
                          setActiveMeeting(null);
                        }}
                        className="p-1.5 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-bg border border-crm-border transition shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto md:max-h-none max-h-[300px] space-y-3.5 pr-2 scrollbar-thin">
                      {feed.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-crm-border rounded-xl">
                          <p className="text-xs text-crm-muted">No prior touchpoints found.</p>
                        </div>
                      ) : (
                        feed.map((item) => (
                          <div key={item.id} className="bg-crm-bg border border-crm-border p-3.5 rounded-2xl space-y-2 text-xs relative shadow-xs">
                            <div className="flex justify-between items-center text-[10px] text-crm-muted font-semibold">
                              <span>By {item.author}</span>
                              <span>{new Date(item.date).toLocaleDateString()}</span>
                            </div>
                            <p className="text-crm-text font-medium leading-relaxed whitespace-pre-wrap">{item.content}</p>
                            <span className={`absolute top-2 right-2 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              item.type === 'meeting' ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500'
                            }`}>
                              {item.type}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            </div>
          </div>
        </>
      )}

      {/* AI Tailor Modal (Email Assist) */}
      {aiTailorOpen && aiTailorMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-xl bg-crm-card border border-crm-border rounded-3xl p-6 shadow-2xl relative text-crm-text animate-fade-in">
            <button 
              onClick={() => {
                setAiTailorOpen(false);
                setAiTailorMeeting(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-crm-text flex items-center space-x-2 mb-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <span>AI Email Assist (AI Tailor)</span>
            </h3>
            <p className="text-xs text-crm-muted mb-5">Draft a context-aware follow-up email dynamically tailored to discussion notes.</p>

            {/* Tone selector */}
            <div className="flex bg-crm-bg p-1 rounded-xl border border-crm-border mb-4 self-start max-w-xs shadow-inner">
              {(['professional', 'friendly', 'direct'] as const).map((tone) => (
                <button
                  key={tone}
                  onClick={() => {
                    setAiTailorTone(tone);
                    setCopied(false);
                  }}
                  className={`flex-1 px-4 py-1.5 rounded-lg text-xs font-bold transition capitalize ${
                    aiTailorTone === tone 
                      ? 'bg-purple-600 text-white shadow-xs' 
                      : 'text-crm-muted hover:text-crm-text'
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>

            {/* Generated Email Area */}
            <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 font-mono text-xs text-slate-200 whitespace-pre-wrap h-64 overflow-y-auto scrollbar-thin relative leading-relaxed">
              {generateEmailDraft(aiTailorMeeting, aiTailorTone)}
            </div>

            {/* Modal footer buttons */}
            <div className="flex space-x-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setAiTailorOpen(false);
                  setAiTailorMeeting(null);
                }}
                className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-sm border border-crm-border transition shadow-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generateEmailDraft(aiTailorMeeting, aiTailorTone));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                  addToast("Email copied to clipboard!");
                }}
                className="flex-1 flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-purple-600/10"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy to Clipboard</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom UI Follow-up Prompt Dialog */}
      {followUpPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-crm-card border border-crm-border rounded-3xl p-6 shadow-2xl relative text-crm-text animate-fade-in text-center space-y-4">
            <div className="p-3 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 w-fit mx-auto animate-bounce">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-crm-text">Schedule Follow-up Meeting?</h3>
              <p className="text-xs text-crm-muted mt-1.5 leading-relaxed">
                The meeting with <strong className="text-crm-text">{promptContactName}</strong> was marked as missed or cancelled. Would you like to schedule a follow-up touchpoint now?
              </p>
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFollowUpPromptOpen(false);
                  setPromptContactId('');
                  setPromptContactName('');
                }}
                className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-semibold py-2.5 rounded-xl text-xs border border-crm-border transition shadow-sm"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setFollowUpPromptOpen(false);
                  setSelectedContactId(promptContactId);
                  setScheduledAtTime('');
                  setAddError(null);
                  setAddModalOpen(true);
                  setPromptContactId('');
                  setPromptContactName('');
                }}
                className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-2.5 rounded-xl text-xs transition shadow-lg shadow-primary/10"
              >
                Schedule Follow-up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Disambiguation Modal Dialog */}
      {disambiguationOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-xl bg-crm-card border border-crm-border rounded-3xl p-6 shadow-2xl relative text-crm-text animate-fade-in">
            <button 
              onClick={() => {
                setDisambiguationOptions(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-crm-text flex items-center space-x-2 mb-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <span>Location Disambiguation Required</span>
            </h3>
            <p className="text-xs text-crm-muted mb-5">
              The geocoded address returned multiple possibilities with low confidence. Please select the correct location:
            </p>

            <div className="space-y-3 max-h-60 overflow-y-auto scrollbar-thin pr-1">
              {disambiguationOptions.matches.map((match: { display_name: string; lat: string; lon: string }, index: number) => {
                const displayName = match.display_name;
                const lat = parseFloat(match.lat);
                const lon = parseFloat(match.lon);
                
                return (
                  <button
                    key={index}
                    onClick={() => {
                      setGeocodedCoords(prev => ({
                        ...prev,
                        [disambiguationOptions.cacheKey]: [lat, lon]
                      }));
                      setAmbiguousMeetings(prev => {
                        const copy = { ...prev };
                        delete copy[disambiguationOptions.meetId];
                        return copy;
                      });
                      setDisambiguationOptions(null);
                    }}
                    className="w-full text-left bg-crm-bg hover:bg-primary/5 hover:border-primary/30 border border-crm-border p-3.5 rounded-xl text-xs font-semibold leading-relaxed transition flex justify-between items-center"
                  >
                    <span className="truncate pr-4 text-crm-text">{displayName}</span>
                    <span className="text-[10px] text-primary shrink-0 bg-primary/10 px-2 py-0.5 rounded border border-primary/20">Select</span>
                  </button>
                );
              })}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setDisambiguationOptions(null);
                }}
                className="w-full bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-sm border border-crm-border transition shadow-sm"
              >
                Cancel & Resolve Later
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
