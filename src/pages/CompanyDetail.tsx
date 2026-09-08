import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCompanyStore, type Company } from '../stores/useCompanyStore';
import { useContactStore, type Contact } from '../stores/useContactStore';
import { useDealStore, type Deal, type DealStage } from '../stores/useDealStore';
import { useNoteStore } from '../stores/useNoteStore';
import { useMeetingStore } from '../stores/useMeetingStore';
import { useUserStore } from '../stores/useUserStore';
import { useAuth } from '../context/AuthContext';
import { getSalespersonLabel, getActiveSalespeople } from '../utils/userHelpers';
import { AddressForm } from '../components/AddressForm';
import { COUNTRY_STATES } from '../utils/addressConstants';
import { geocodeStructuredAddress, type GeocodingMatch } from '../utils/geocoding';
import { 
  Building2, 
  Globe, 
  Phone, 
  MapPin, 
  ArrowLeft, 
  Users, 
  Briefcase, 
  MessageSquare,
  Plus,
  Trash2,
  Edit,
  ExternalLink,
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';

export const CompanyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [now] = useState(() => Date.now());

  // Load stores
  const companies = useCompanyStore(state => state.companies);
  const contacts = useContactStore(state => state.contacts);
  const deals = useDealStore(state => state.deals);
  const notes = useNoteStore(state => state.notes);
  const meetings = useMeetingStore(state => state.meetings);
  const users = useUserStore(state => state.users);

  const initCompanies = useCompanyStore(state => state.initialize);
  const initContacts = useContactStore(state => state.initialize);
  const initDeals = useDealStore(state => state.initialize);
  const initNotes = useNoteStore(state => state.initialize);
  const initMeetings = useMeetingStore(state => state.initialize);

  const updateCompany = useCompanyStore(state => state.updateCompany);
  const addContact = useContactStore(state => state.addContact);
  const updateContact = useContactStore(state => state.updateContact);
  const deleteContact = useContactStore(state => state.deleteContact);
  const addDeal = useDealStore(state => state.addDeal);
  const updateDeal = useDealStore(state => state.updateDeal);
  const deleteDeal = useDealStore(state => state.deleteDeal);
  const addNote = useNoteStore(state => state.addNote);
  const deleteNote = useNoteStore(state => state.deleteNote);
  const addMeeting = useMeetingStore(state => state.addMeeting);

  // Form note & correspondence logging
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [logType, setLogType] = useState<'note' | 'meeting'>('note');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [customOutcomes, setCustomOutcomes] = useState<{ id: string; label: string; workflow: string }[]>(() => {
    const stored = localStorage.getItem('crm_meeting_outcomes');
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
    localStorage.setItem('crm_meeting_outcomes', JSON.stringify(defaults));
    return defaults;
  });

  const [meetingOutcome, setMeetingOutcome] = useState<string>(() => {
    const stored = localStorage.getItem('crm_meeting_outcomes');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) return parsed[0].label;
      } catch {
        // ignore
      }
    }
    return 'Successfully Ordered / Reordered';
  });

  // Edit Company Profile Modal state
  const [editCompanyModalOpen, setEditCompanyModalOpen] = useState(false);
  const [compName, setCompName] = useState('');
  const [compDomain, setCompDomain] = useState('');
  const [compIndustry, setCompIndustry] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compTier, setCompTier] = useState<'A' | 'B' | 'C'>('B');
  const [compPrimaryOwner, setCompPrimaryOwner] = useState('Rebecca Fett');
  const [compStreet, setCompStreet] = useState('');
  const [compSuburb, setCompSuburb] = useState('');
  const [compState, setCompState] = useState('');
  const [compCountry, setCompCountry] = useState('');
  const [compPostcode, setCompPostcode] = useState('');
  const [compLatitude, setCompLatitude] = useState<number | undefined>(undefined);
  const [compLongitude, setCompLongitude] = useState<number | undefined>(undefined);
  const [compFormError, setCompFormError] = useState<string | null>(null);

  // Geocoding Intercept State
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [disambiguationOpen, setDisambiguationOpen] = useState(false);
  const [disambiguationMatches, setDisambiguationMatches] = useState<GeocodingMatch[]>([]);
  const [pendingCompanySave, setPendingCompanySave] = useState<Omit<Company, 'id' | 'createdAt' | 'updatedAt'> | null>(null);

  // Contact Modal State
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [ctName, setCtName] = useState('');
  const [ctEmail, setCtEmail] = useState('');
  const [ctPhone, setCtPhone] = useState('');
  const [ctRole, setCtRole] = useState('');
  const [ctStatus, setCtStatus] = useState<'prospect' | 'client' | 'inactive'>('prospect');
  const [ctTier, setCtTier] = useState<'A' | 'B' | 'C'>('B');
  const [ctPrimaryOwner, setCtPrimaryOwner] = useState('Rebecca Fett');
  const [contactFormError, setContactFormError] = useState<string | null>(null);

  // Deal Modal State
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [dlName, setDlName] = useState('');
  const [dlValue, setDlValue] = useState<number | ''>(0);
  const [dlStage, setDlStage] = useState<DealStage>('qualification');
  const [dlContactId, setDlContactId] = useState('');
  const [dlSalespersonId, setDlSalespersonId] = useState('');
  const [dealFormError, setDealFormError] = useState<string | null>(null);

  useEffect(() => {
    const loadOutcomes = () => {
      const stored = localStorage.getItem('crm_meeting_outcomes');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { id: string; label: string; workflow: string }[];
          setCustomOutcomes(parsed);
          setMeetingOutcome(current => {
            if (parsed.length > 0 && !parsed.some((o) => o.label === current)) {
              return parsed[0].label;
            }
            return current;
          });
        } catch (err) {
          console.error(err);
        }
      }
    };
    window.addEventListener('crm-outcomes-updated', loadOutcomes);
    return () => window.removeEventListener('crm-outcomes-updated', loadOutcomes);
  }, []);

  useEffect(() => {
    const unsubComp = initCompanies();
    const unsubCont = initContacts();
    const unsubDeals = initDeals();
    const unsubNotes = initNotes();
    const unsubMeet = initMeetings();

    return () => {
      unsubComp();
      unsubCont();
      unsubDeals();
      unsubNotes();
      unsubMeet();
    };
  }, [initCompanies, initContacts, initDeals, initNotes, initMeetings]);

  // Find company
  const company = companies.find(c => c.id === id);

  if (!company) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button 
          onClick={() => navigate('/companies')}
          className="flex items-center space-x-2 text-crm-muted hover:text-crm-text transition text-sm font-semibold border border-transparent hover:border-crm-border hover:bg-crm-card px-2.5 py-1 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to companies</span>
        </button>
        <div className="text-center py-20 bg-crm-card border border-crm-border rounded-2xl">
          <Building2 className="h-12 w-12 text-crm-muted mx-auto mb-4" />
          <p className="text-crm-text font-bold text-lg">Company not found</p>
          <p className="text-crm-muted text-sm mt-1">The company record you are looking for does not exist.</p>
        </div>
      </div>
    );
  }

  // Filter associated assets
  const companyContacts = contacts.filter(c => c.companyId === id);
  const companyDeals = deals.filter(d => d.companyId === id);
  
  // Staged / associated contact IDs for lookup
  const contactIdSet = new Set(companyContacts.map(c => c.id));

  // Group completed meetings for company and its contacts
  const associatedMeetings = meetings.filter(m => 
    (m.companyId === id || contactIdSet.has(m.contactId)) && 
    m.status === 'completed'
  );

  // Direct notes on company PLUS notes attached to company's contacts
  const associatedNotes = notes.filter(n => 
    (n.parentType === 'company' && n.parentId === id) ||
    (n.parentType === 'contact' && contactIdSet.has(n.parentId))
  );

  // Map them to a unified format
  interface LogItem {
    id: string;
    type: 'meeting' | 'note';
    date: string;
    salespersonName: string;
    content: string;
    extra?: string; // outcome for meetings
    contactName?: string; // contact name if associated
  }

  const logItems: LogItem[] = [
    ...associatedMeetings.map(m => ({
      id: m.id,
      type: 'meeting' as const,
      date: m.completedAt || m.scheduledAt,
      salespersonName: getSalespersonLabel(users, m.salespersonId),
      content: m.comments || 'Touchpoint meeting logged.',
      extra: m.outcome,
      contactName: m.contactName,
    })),
    ...associatedNotes.map(n => ({
      id: n.id,
      type: 'note' as const,
      date: n.createdAt,
      salespersonName: getSalespersonLabel(users, n.createdBy || n.createdByName),
      content: n.content,
      contactName: companyContacts.find(c => c.id === n.parentId)?.name,
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Find last touchpoint
  const lastTouchpoint = logItems.length > 0 ? logItems[0] : null;
  const daysSinceLastTouchpoint = lastTouchpoint 
    ? Math.max(0, Math.floor((now - new Date(lastTouchpoint.date).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  // --- Handlers: Company Edit ---
  const openEditCompanyModal = () => {
    setCompName(company.name);
    setCompDomain(company.domain || '');
    setCompIndustry(company.industry || '');
    setCompPhone(company.phone || '');
    setCompTier(company.tier || 'B');
    setCompPrimaryOwner(company.primaryOwner === 'John Salesperson' ? 'Rebecca Fett' : (company.primaryOwner || 'Rebecca Fett'));
    setCompStreet(company.street || '');
    setCompSuburb(company.suburb || '');
    setCompState(company.state || '');
    setCompCountry(company.country || '');
    setCompPostcode(company.postcode || '');
    setCompLatitude(company.latitude);
    setCompLongitude(company.longitude);
    setCompFormError(null);
    setEditCompanyModalOpen(true);
  };

  const proceedWithCompanySave = async (data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await updateCompany(company.id, data);
      setEditCompanyModalOpen(false);
    } catch (err: unknown) {
      setCompFormError(err instanceof Error ? err.message : 'Error updating company profile.');
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompFormError(null);

    if (!compName.trim()) {
      setCompFormError('Please enter a company name.');
      return;
    }

    const hasAddress = !!(compStreet.trim() || compSuburb.trim() || compState.trim() || compCountry.trim() || compPostcode.trim());
    if (hasAddress && !compSuburb.trim()) {
      setCompFormError('Suburb/City is required when entering address details.');
      return;
    }

    const companyData = {
      name: compName.trim(),
      domain: compDomain.trim(),
      industry: compIndustry.trim(),
      phone: compPhone.trim(),
      street: compStreet.trim(),
      suburb: compSuburb.trim(),
      state: compState.trim(),
      country: compCountry.trim(),
      postcode: compPostcode.trim(),
      latitude: compLatitude,
      longitude: compLongitude,
      tier: compTier,
      primaryOwner: compPrimaryOwner,
      assignedSalespersonId: company.assignedSalespersonId || user?.uid || '',
    };

    if (hasAddress && (compLatitude === undefined || compLongitude === undefined)) {
      setIsGeocoding(true);
      try {
        const matches = await geocodeStructuredAddress({
          street: compStreet.trim(),
          suburb: compSuburb.trim(),
          state: compState.trim(),
          country: compCountry.trim(),
          postcode: compPostcode.trim(),
        });

        if (!matches || matches.length === 0) {
          setCompFormError('Geocoding verification failed: No matching locations found. Please check spelling or details.');
          setIsGeocoding(false);
          return;
        }

        const topMatch = matches[0];
        const confidence = topMatch.importance || 0;

        if (confidence >= 0.90 || matches.length === 1) {
          const lat = parseFloat(topMatch.lat);
          const lon = parseFloat(topMatch.lon);
          companyData.latitude = isNaN(lat) ? undefined : lat;
          companyData.longitude = isNaN(lon) ? undefined : lon;
          await proceedWithCompanySave(companyData);
        } else {
          setDisambiguationMatches(matches);
          setPendingCompanySave(companyData);
          setDisambiguationOpen(true);
        }
      } catch (err) {
        console.error(err);
        await proceedWithCompanySave(companyData);
      } finally {
        setIsGeocoding(false);
      }
    } else {
      await proceedWithCompanySave(companyData);
    }
  };

  const handleSelectDisambiguationMatch = async (match: GeocodingMatch) => {
    if (!pendingCompanySave) return;

    const lat = parseFloat(match.lat);
    const lon = parseFloat(match.lon);
    const addr = match.address || {};

    const houseNumber = addr.house_number ? `${addr.house_number} ` : '';
    const road = addr.road || '';
    const streetVal = `${houseNumber}${road}`.trim() || match.display_name.split(',')[0];
    const cityOrSuburb = addr.suburb || addr.city || addr.town || addr.village || pendingCompanySave.suburb;
    
    const rawCountryCode = (addr.country_code || '').toUpperCase();
    let countryVal = pendingCompanySave.country;
    if (rawCountryCode) countryVal = rawCountryCode;

    const rawState = addr.state || addr.province || '';
    const stateVal = (countryVal && COUNTRY_STATES[countryVal])
      ? (COUNTRY_STATES[countryVal].find(
          s => s.value.toLowerCase() === rawState.toLowerCase().trim() || s.label.toLowerCase().includes(rawState.toLowerCase().trim())
        )?.value || rawState)
      : (rawState || pendingCompanySave.state);

    const postcodeVal = addr.postcode || pendingCompanySave.postcode;

    const finalData = {
      ...pendingCompanySave,
      street: streetVal,
      suburb: cityOrSuburb,
      state: stateVal,
      country: countryVal,
      postcode: postcodeVal,
      latitude: isNaN(lat) ? undefined : lat,
      longitude: isNaN(lon) ? undefined : lon,
    };

    setDisambiguationOpen(false);
    setPendingCompanySave(null);
    await proceedWithCompanySave(finalData);
  };

  // --- Handlers: Contact Add / Edit / Delete ---
  const openAddContactModal = () => {
    setEditingContactId(null);
    setCtName('');
    setCtEmail('');
    setCtPhone('');
    setCtRole('');
    setCtStatus('prospect');
    setCtTier('B');
    setCtPrimaryOwner(user?.displayName || 'Rebecca Fett');
    setContactFormError(null);
    setContactModalOpen(true);
  };

  const openEditContactModal = (c: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingContactId(c.id);
    setCtName(c.name);
    setCtEmail(c.email);
    setCtPhone(c.phone);
    setCtRole(c.role);
    setCtStatus(c.status);
    setCtTier(c.tier || 'B');
    setCtPrimaryOwner(c.primaryOwner === 'John Salesperson' ? 'Rebecca Fett' : (c.primaryOwner || 'Rebecca Fett'));
    setContactFormError(null);
    setContactModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactFormError(null);
    if (!ctName.trim()) {
      setContactFormError('Please enter contact name.');
      return;
    }

    try {
      if (editingContactId) {
        await updateContact(editingContactId, {
          name: ctName.trim(),
          email: ctEmail.trim(),
          phone: ctPhone.trim(),
          role: ctRole.trim(),
          status: ctStatus,
          tier: ctTier,
          primaryOwner: ctPrimaryOwner,
        });
      } else {
        await addContact({
          name: ctName.trim(),
          email: ctEmail.trim(),
          phone: ctPhone.trim(),
          role: ctRole.trim(),
          status: ctStatus,
          tier: ctTier,
          primaryOwner: ctPrimaryOwner,
          companyId: company.id,
          companyName: company.name,
          assignedSalespersonId: user?.uid || '',
        });
      }
      setContactModalOpen(false);
    } catch (err: unknown) {
      setContactFormError(err instanceof Error ? err.message : 'Error saving contact.');
    }
  };

  const handleDeleteContactRow = async (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        await deleteContact(contactId);
      } catch (err) {
        console.error('Failed to delete contact:', err);
      }
    }
  };

  // --- Handlers: Deal Add / Edit / Delete ---
  const openAddDealModal = () => {
    setEditingDealId(null);
    setDlName('');
    setDlValue(0);
    setDlStage('qualification');
    setDlContactId(companyContacts[0]?.id || '');
    setDlSalespersonId(user?.uid || 'sales-uid');
    setDealFormError(null);
    setDealModalOpen(true);
  };

  const openEditDealModal = (d: Deal, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDealId(d.id);
    setDlName(d.name);
    setDlValue(d.value);
    setDlStage(d.stage);
    setDlContactId(d.contactId || '');
    setDlSalespersonId(d.assignedSalespersonId || user?.uid || 'sales-uid');
    setDealFormError(null);
    setDealModalOpen(true);
  };

  const handleSaveDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setDealFormError(null);
    if (!dlName.trim()) {
      setDealFormError('Please enter a deal name.');
      return;
    }
    const valNum = Number(dlValue);
    if (isNaN(valNum) || valNum < 0) {
      setDealFormError('Please enter a valid deal value.');
      return;
    }

    const selectedContact = companyContacts.find(c => c.id === dlContactId);
    const contactName = selectedContact ? selectedContact.name : '';

    try {
      if (editingDealId) {
        await updateDeal(editingDealId, {
          name: dlName.trim(),
          value: valNum,
          stage: dlStage,
          contactId: dlContactId,
          contactName: contactName,
          assignedSalespersonId: dlSalespersonId,
        });
      } else {
        await addDeal({
          name: dlName.trim(),
          value: valNum,
          stage: dlStage,
          companyId: company.id,
          companyName: company.name,
          contactId: dlContactId,
          contactName: contactName,
          assignedSalespersonId: dlSalespersonId,
        });
      }
      setDealModalOpen(false);
    } catch (err: unknown) {
      setDealFormError(err instanceof Error ? err.message : 'Error saving deal.');
    }
  };

  const handleDeleteDealRow = async (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this deal?')) {
      try {
        await deleteDeal(dealId);
      } catch (err) {
        console.error('Failed to delete deal:', err);
      }
    }
  };

  // --- Handlers: Notes & Meetings ---
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !id) return;

    setNoteLoading(true);
    try {
      if (logType === 'note') {
        await addNote({
          content: newNoteContent.trim(),
          parentId: id,
          parentType: 'company',
          createdBy: user?.uid || '',
          createdByName: user?.displayName || 'Unknown User',
        });
      } else {
        const contactObj = companyContacts.find(c => c.id === selectedContactId) || companyContacts[0];
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        await addMeeting({
          contactId: contactObj?.id || 'no-contact',
          contactName: contactObj?.name || 'Company Contact',
          companyId: id,
          companyName: company.name,
          salespersonId: user?.uid || '',
          month: currentMonth,
          status: 'completed',
          outcome: meetingOutcome,
          comments: newNoteContent.trim(),
          scheduledAt: now.toISOString(),
          completedAt: now.toISOString(),
        });
      }
      setNewNoteContent('');
    } catch (err) {
      console.error('Failed to log correspondence:', err);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      try {
        await deleteNote(noteId);
      } catch (err) {
        console.error('Failed to delete note:', err);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-crm-text">
      {/* Navigation & Header */}
      <div>
        <button 
          onClick={() => navigate('/companies')}
          className="flex items-center space-x-2 text-crm-muted hover:text-crm-text transition text-sm font-semibold mb-4 border border-transparent hover:border-crm-border hover:bg-crm-card px-2.5 py-1 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to companies</span>
        </button>
        
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3.5 rounded-2xl bg-primary/10 text-primary border border-primary/25 shadow-sm">
              <Building2 className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-crm-text">{company.name}</h1>
                <button
                  onClick={openEditCompanyModal}
                  className="p-1.5 rounded-xl bg-crm-card hover:bg-crm-bg border border-crm-border hover:border-primary text-crm-muted hover:text-primary transition shadow-xs flex items-center space-x-1 text-xs font-semibold px-2.5"
                  title="Edit Company Details & Address"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Edit Profile</span>
                </button>
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  company.tier === 'A' 
                    ? 'bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400' 
                    : company.tier === 'B'
                    ? 'bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400'
                    : 'bg-slate-500/10 border-slate-500/25 text-slate-600 dark:text-slate-400'
                }`}>
                  Tier {company.tier || 'B'}
                </span>
                <span className="text-xs text-crm-muted">&bull; Assigned salesperson: {getSalespersonLabel(users, company.assignedSalespersonId || company.primaryOwner)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={openAddContactModal}
              className="bg-crm-bg hover:bg-crm-border border border-crm-border text-crm-text font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
            >
              <Plus className="h-4 w-4 text-primary" />
              <span>Add Contact</span>
            </button>
            <button
              onClick={openAddDealModal}
              className="bg-primary hover:bg-primary-hover text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition shadow-md shadow-primary/10"
            >
              <Plus className="h-4 w-4" />
              <span>New Deal</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Last Touchpoint Summary Card */}
        <div className="bg-crm-card border border-crm-border p-6 rounded-2xl shadow-sm flex items-center justify-between col-span-1 lg:col-span-3 animate-fade-in">
          <div className="flex items-center space-x-3.5">
            <div className={`p-3 rounded-xl border ${
              lastTouchpoint 
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' 
                : 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
            }`}>
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-crm-muted uppercase tracking-wider">Last Interaction / Visit</p>
              <h4 className="text-sm font-bold text-crm-text mt-1.5 leading-relaxed">
                {lastTouchpoint ? (
                  <span>
                    Last touched <strong className="text-primary font-extrabold">{daysSinceLastTouchpoint}</strong> days ago on{' '}
                    <span className="font-semibold text-crm-text">
                      {new Date(lastTouchpoint.date).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>{' '}
                    by <strong className="font-semibold text-crm-text">{lastTouchpoint.salespersonName}</strong> ({lastTouchpoint.type === 'meeting' ? `Completed Meeting ${lastTouchpoint.contactName ? `with ${lastTouchpoint.contactName}` : ''}` : `Logged Note ${lastTouchpoint.contactName ? `for ${lastTouchpoint.contactName}` : ''}`})
                  </span>
                ) : (
                  'No previous visits or logs recorded.'
                )}
              </h4>
            </div>
          </div>
          {lastTouchpoint && lastTouchpoint.extra && (
            <div className="hidden md:block">
              <span className="text-xs bg-crm-bg border border-crm-border text-primary font-bold px-3 py-1.5 rounded-full capitalize">
                Outcome: {lastTouchpoint.extra}
              </span>
            </div>
          )}
        </div>
        
        {/* Left Column: Company Profile Card */}
        <div className="bg-crm-card border border-crm-border p-6 rounded-2xl space-y-6 self-start shadow-sm relative group">
          <div className="flex justify-between items-center border-b border-crm-border/60 pb-3">
            <h3 className="text-sm font-bold text-crm-muted uppercase tracking-wider">Company Profile</h3>
            <button
              onClick={openEditCompanyModal}
              className="text-xs text-primary hover:underline font-bold flex items-center space-x-1"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Edit Details</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider">Website Domain</p>
              <a 
                href={`https://${company.domain}`} 
                target="_blank" 
                rel="noreferrer"
                className="text-sm text-primary hover:text-primary-hover font-semibold hover:underline mt-1 flex items-center space-x-1.5"
              >
                <Globe className="h-4 w-4 shrink-0" />
                <span>{company.domain || 'N/A'}</span>
              </a>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider">Primary Account Owner</p>
              <div className="text-sm font-semibold text-crm-text mt-1 capitalize bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl inline-block shadow-xs">
                {company.primaryOwner === 'John Salesperson' ? 'Rebecca Fett' : (company.primaryOwner || 'Rebecca Fett')}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider">Industry</p>
              <span className="inline-block text-xs bg-crm-bg border border-crm-border text-crm-text px-3 py-1 rounded-full font-medium mt-1 capitalize">
                {company.industry || 'General Business'}
              </span>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider">Phone</p>
              <p className="text-sm text-crm-text mt-1 flex items-center space-x-2 font-medium">
                <Phone className="h-4 w-4 text-crm-muted" />
                <span>{company.phone || 'No phone recorded'}</span>
              </p>
            </div>

            {/* Split Address formatted to Global standards */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider">Office Address</p>
              </div>
              <div className="text-xs text-crm-muted mt-1 flex items-start space-x-2 leading-relaxed bg-crm-bg p-3 rounded-xl border border-crm-border">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p><span className="font-semibold text-crm-text">Street:</span> {company.street || 'N/A'}</p>
                  <p><span className="font-semibold text-crm-text">Suburb:</span> {company.suburb || 'N/A'}</p>
                  <p><span className="font-semibold text-crm-text">State:</span> {company.state || 'N/A'}</p>
                  <p><span className="font-semibold text-crm-text">Country:</span> {company.country || 'N/A'}</p>
                  {company.postcode && <p><span className="font-semibold text-crm-text">Postcode:</span> {company.postcode}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Relationships and Notes Feed */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Associated Contacts widget */}
          <div className="bg-crm-card border border-crm-border p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-crm-muted uppercase tracking-wider flex items-center space-x-2">
                <Users className="h-4.5 w-4.5 text-primary" />
                <span>Contacts ({companyContacts.length})</span>
              </h3>
              <button
                onClick={openAddContactModal}
                className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center space-x-1 bg-primary/10 hover:bg-primary/15 border border-primary/20 px-2.5 py-1 rounded-lg transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Contact</span>
              </button>
            </div>

            {companyContacts.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-crm-border rounded-xl">
                <p className="text-crm-muted text-sm mb-2">No contacts associated with this company yet</p>
                <button
                  onClick={openAddContactModal}
                  className="text-xs bg-primary text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-hover transition"
                >
                  Create First Contact
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {companyContacts.map(c => (
                  <div 
                    key={c.id}
                    className="flex justify-between items-center bg-crm-bg/40 border border-crm-border p-4 rounded-xl hover:border-primary/20 transition shadow-sm"
                  >
                    <div>
                      <Link 
                        to={`/contacts/${c.id}`} 
                        className="text-sm font-semibold text-crm-text hover:text-primary transition"
                      >
                        {c.name}
                      </Link>
                      <p className="text-xs text-crm-muted mt-0.5">{c.role || 'No role'} &bull; {c.email || 'No email'} &bull; <strong className="text-primary font-bold">Tier {c.tier || 'B'}</strong></p>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={(e) => openEditContactModal(c, e)}
                        className="p-1.5 rounded-lg bg-crm-card text-crm-muted hover:text-primary border border-crm-border hover:border-crm-muted/30 transition"
                        title="Edit Contact"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteContactRow(c.id, e)}
                        className="p-1.5 rounded-lg bg-crm-card text-crm-muted hover:text-rose-500 border border-crm-border hover:border-crm-muted/30 transition"
                        title="Delete Contact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <Link 
                        to={`/contacts/${c.id}`} 
                        className="p-1.5 rounded-lg bg-crm-card text-crm-muted hover:text-crm-text border border-crm-border hover:border-crm-muted/30 transition"
                        title="View Full Profile"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Associated Deals widget */}
          <div className="bg-crm-card border border-crm-border p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-crm-muted uppercase tracking-wider flex items-center space-x-2">
                <Briefcase className="h-4.5 w-4.5 text-primary" />
                <span>Deals ({companyDeals.length})</span>
              </h3>
              <button
                onClick={openAddDealModal}
                className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center space-x-1 bg-primary/10 hover:bg-primary/15 border border-primary/20 px-2.5 py-1 rounded-lg transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Deal</span>
              </button>
            </div>

            {companyDeals.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-crm-border rounded-xl">
                <p className="text-crm-muted text-sm mb-2">No active deals linked to this company yet</p>
                <button
                  onClick={openAddDealModal}
                  className="text-xs bg-primary text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-hover transition"
                >
                  Create First Deal
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {companyDeals.map(d => (
                  <div 
                    key={d.id}
                    className="flex justify-between items-center bg-crm-bg/40 border border-crm-border p-4 rounded-xl shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-semibold text-crm-text">{d.name}</p>
                      <p className="text-xs text-crm-muted capitalize mt-0.5">Stage: <strong className="text-primary font-semibold">{d.stage}</strong> {d.contactName ? `• Contact: ${d.contactName}` : ''}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        ${d.value.toLocaleString()}
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => openEditDealModal(d, e)}
                          className="p-1.5 rounded-lg bg-crm-card text-crm-muted hover:text-primary border border-crm-border hover:border-crm-muted/30 transition"
                          title="Edit Deal"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteDealRow(d.id, e)}
                          className="p-1.5 rounded-lg bg-crm-card text-crm-muted hover:text-rose-500 border border-crm-border hover:border-crm-muted/30 transition"
                          title="Delete Deal"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consolidated Activity & Correspondence Log widget */}
          <div className="bg-crm-card border border-crm-border p-6 rounded-2xl space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-crm-muted uppercase tracking-wider flex items-center space-x-2">
              <MessageSquare className="h-4.5 w-4.5 text-primary" />
              <span>Activity & Correspondence Log</span>
            </h3>

            {/* Correspondence type select & form */}
            <form onSubmit={handleAddNote} className="space-y-4">
              <div className="flex items-center space-x-4 bg-crm-bg p-1.5 rounded-xl border border-crm-border shadow-inner">
                <button
                  type="button"
                  onClick={() => setLogType('note')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${logType === 'note' ? 'bg-primary text-white shadow-sm' : 'text-crm-muted hover:text-crm-text'}`}
                >
                  Add Internal Note
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLogType('meeting');
                    if (companyContacts.length > 0 && !selectedContactId) {
                      setSelectedContactId(companyContacts[0].id);
                    }
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${logType === 'meeting' ? 'bg-primary text-white shadow-sm' : 'text-crm-muted hover:text-crm-text'}`}
                >
                  Log Completed Visit/Meeting
                </button>
              </div>

              {logType === 'meeting' && companyContacts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-crm-bg/40 p-4 border border-crm-border rounded-2xl animate-fade-in">
                  <div>
                    <label className="block text-[10px] font-bold text-crm-muted uppercase tracking-wider mb-2">Contact Spoken To *</label>
                    <select
                      value={selectedContactId}
                      onChange={(e) => setSelectedContactId(e.target.value)}
                      className="w-full bg-crm-card border border-crm-border focus:border-primary rounded-xl px-3 py-2 text-xs text-crm-text outline-none transition"
                    >
                      {companyContacts.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-crm-muted uppercase tracking-wider mb-2">Outcome *</label>
                    <select
                      value={meetingOutcome}
                      onChange={(e) => setMeetingOutcome(e.target.value)}
                      className="w-full bg-crm-card border border-crm-border focus:border-primary rounded-xl px-3 py-2 text-xs text-crm-text outline-none transition cursor-pointer"
                    >
                      {customOutcomes.map(o => (
                        <option key={o.id} value={o.label}>{o.label}</option>
                      ))}
                      {meetingOutcome && !customOutcomes.some(o => o.label === meetingOutcome) && (
                        <option value={meetingOutcome} disabled>{meetingOutcome}</option>
                      )}
                    </select>
                  </div>
                </div>
              )}

              <textarea
                placeholder={logType === 'note' ? "Type a note or comment to attach to this company..." : "Enter details/comments of what was discussed during this salesperson visit..."}
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl p-3.5 text-sm text-crm-text placeholder-crm-muted outline-none transition h-24 resize-none"
                required
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={noteLoading || !newNoteContent.trim()}
                  className="flex items-center space-x-1.5 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white px-4 py-2 rounded-xl font-semibold text-sm transition shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>{logType === 'note' ? 'Attach Note' : 'Log Correspondence'}</span>
                </button>
              </div>
            </form>

            {/* Combined Timeline list */}
            <div className="space-y-4 pt-4 border-t border-crm-border">
              {logItems.length === 0 ? (
                <p className="text-crm-muted text-xs italic text-center py-4">No notes or correspondence logged yet.</p>
              ) : (
                logItems.map((item) => (
                  <div 
                    key={item.id} 
                    className={`border p-4.5 rounded-2xl space-y-3 relative group shadow-xs transition-all hover:shadow-sm ${
                      item.type === 'meeting'
                        ? 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-500/10'
                        : 'bg-crm-bg/40 border-crm-border'
                    }`}
                  >
                    {item.type === 'note' && (
                      <button
                        onClick={() => handleDeleteNote(item.id)}
                        className="absolute top-4 right-4 text-crm-muted hover:text-rose-500 opacity-0 group-hover:opacity-100 transition p-1 hover:bg-crm-bg border border-transparent hover:border-crm-border rounded-lg"
                        title="Delete Note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <div className="flex justify-between items-center text-xs text-crm-muted">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                          item.type === 'meeting'
                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-500/10 border-slate-500/25 text-slate-600 dark:text-slate-400'
                        }`}>
                          {item.type === 'meeting' ? 'Completed Meeting' : 'Internal Note'}
                        </span>
                        {item.contactName && (
                          <span className="font-bold text-crm-text">
                            Spoke with: {item.contactName}
                          </span>
                        )}
                      </div>
                      <span className="font-semibold">
                        {new Date(item.date).toLocaleString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <p className="text-sm text-crm-text leading-relaxed whitespace-pre-wrap font-medium">{item.content}</p>

                    <div className="flex justify-between items-center text-xs text-crm-muted pt-2.5 border-t border-crm-border/40">
                      <span>Logged by: <strong className="text-crm-text font-semibold">{item.salespersonName}</strong></span>
                      {item.type === 'meeting' && item.extra && (
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 capitalize">
                          Outcome: {item.extra}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>

        </div>

      </div>

      {/* --- EDIT COMPANY MODAL (Portaled) --- */}
      {editCompanyModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-950/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="w-full max-w-4xl bg-crm-card border border-crm-border rounded-3xl p-6 md:p-8 shadow-2xl relative text-crm-text my-auto max-h-[88vh] overflow-y-auto scrollbar-thin animate-scale-in">
            <button 
              type="button"
              onClick={() => setEditCompanyModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-xl text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-crm-text">Edit Company Profile & Address</h3>
                <p className="text-xs text-crm-muted mt-0.5">Update organization info and location details</p>
              </div>
            </div>

            {compFormError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold p-3.5 rounded-xl mb-6 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{compFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCompany} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* Left Column: Core Info */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Company Information</h4>
                  
                  <div>
                    <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Company Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Tesla Motors"
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted/60 outline-none transition"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Website Domain</label>
                      <input
                        type="text"
                        placeholder="e.g. tesla.com"
                        value={compDomain}
                        onChange={(e) => setCompDomain(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted/60 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Industry</label>
                      <input
                        type="text"
                        placeholder="e.g. Automotive"
                        value={compIndustry}
                        onChange={(e) => setCompIndustry(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted/60 outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Phone</label>
                      <input
                        type="text"
                        placeholder="e.g. 1-800-555-0199"
                        value={compPhone}
                        onChange={(e) => setCompPhone(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted/60 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Account Tier *</label>
                      <select
                        value={compTier}
                        onChange={(e) => setCompTier(e.target.value as 'A' | 'B' | 'C')}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                        required
                      >
                        <option value="A">Tier A (Enterprise - 30d Touchpoint)</option>
                        <option value="B">Tier B (Mid-Market - 60d Touchpoint)</option>
                        <option value="C">Tier C (SMB - 90d Touchpoint)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Primary Owner *</label>
                    <select
                      value={compPrimaryOwner}
                      onChange={(e) => setCompPrimaryOwner(e.target.value)}
                      className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                      required
                    >
                      {getActiveSalespeople(users).map((u) => (
                        <option key={u.uid} value={u.displayName}>
                          {u.displayName}
                        </option>
                      ))}
                      {compPrimaryOwner && !getActiveSalespeople(users).some((u) => u.displayName === compPrimaryOwner) && (
                        <option value={compPrimaryOwner}>{getSalespersonLabel(users, compPrimaryOwner)}</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Right Column: Office Address */}
                <div className="space-y-4 bg-crm-bg/20 p-5 rounded-2xl border border-crm-border">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Office Address</h4>
                  <AddressForm
                    value={{ 
                      street: compStreet, 
                      suburb: compSuburb, 
                      state: compState, 
                      country: compCountry, 
                      postcode: compPostcode, 
                      latitude: compLatitude, 
                      longitude: compLongitude 
                    }}
                    onChange={(val) => {
                      setCompStreet(val.street);
                      setCompSuburb(val.suburb);
                      setCompState(val.state);
                      setCompCountry(val.country);
                      setCompPostcode(val.postcode);
                      setCompLatitude(val.latitude);
                      setCompLongitude(val.longitude);
                    }}
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-crm-border/60">
                <button
                  type="button"
                  onClick={() => setEditCompanyModalOpen(false)}
                  className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-sm border border-crm-border transition shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-primary/10"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- ADD / EDIT CONTACT MODAL (Portaled) --- */}
      {contactModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-950/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="w-full max-w-lg bg-crm-card border border-crm-border rounded-3xl p-6 md:p-8 shadow-2xl relative text-crm-text my-auto max-h-[88vh] overflow-y-auto scrollbar-thin animate-scale-in">
            <button 
              type="button"
              onClick={() => setContactModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-xl text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-crm-text">{editingContactId ? 'Edit Contact' : 'Add New Contact'}</h3>
                <p className="text-xs text-crm-muted mt-0.5">Associated with <strong className="text-crm-text">{company.name}</strong></p>
              </div>
            </div>

            {contactFormError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold p-3.5 rounded-xl mb-6 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{contactFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveContact} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Contact Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={ctName}
                  onChange={(e) => setCtName(e.target.value)}
                  className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. jane@company.com"
                    value={ctEmail}
                    onChange={(e) => setCtEmail(e.target.value)}
                    className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 555-0199"
                    value={ctPhone}
                    onChange={(e) => setCtPhone(e.target.value)}
                    className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Role / Title</label>
                  <input
                    type="text"
                    placeholder="e.g. VP Sales"
                    value={ctRole}
                    onChange={(e) => setCtRole(e.target.value)}
                    className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Status</label>
                  <select
                    value={ctStatus}
                    onChange={(e) => setCtStatus(e.target.value as 'prospect' | 'client' | 'inactive')}
                    className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                  >
                    <option value="prospect">Prospect</option>
                    <option value="client">Client</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Account Tier</label>
                  <select
                    value={ctTier}
                    onChange={(e) => setCtTier(e.target.value as 'A' | 'B' | 'C')}
                    className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                  >
                    <option value="A">Tier A</option>
                    <option value="B">Tier B</option>
                    <option value="C">Tier C</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Primary Owner</label>
                  <select
                    value={ctPrimaryOwner}
                    onChange={(e) => setCtPrimaryOwner(e.target.value)}
                    className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                  >
                    {getActiveSalespeople(users).map((u) => (
                      <option key={u.uid} value={u.displayName}>{u.displayName}</option>
                    ))}
                    {ctPrimaryOwner && !getActiveSalespeople(users).some(u => u.displayName === ctPrimaryOwner) && (
                      <option value={ctPrimaryOwner}>{getSalespersonLabel(users, ctPrimaryOwner)}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-crm-border/60">
                <button
                  type="button"
                  onClick={() => setContactModalOpen(false)}
                  className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-sm border border-crm-border transition shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-primary/10"
                >
                  {editingContactId ? 'Update Contact' : 'Create Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- ADD / EDIT DEAL MODAL (Portaled) --- */}
      {dealModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-950/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="w-full max-w-lg bg-crm-card border border-crm-border rounded-3xl p-6 md:p-8 shadow-2xl relative text-crm-text my-auto max-h-[88vh] overflow-y-auto scrollbar-thin animate-scale-in">
            <button 
              type="button"
              onClick={() => setDealModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-xl text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Briefcase className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-crm-text">{editingDealId ? 'Edit Deal' : 'Add New Deal'}</h3>
                <p className="text-xs text-crm-muted mt-0.5">Linked to <strong className="text-crm-text">{company.name}</strong></p>
              </div>
            </div>

            {dealFormError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold p-3.5 rounded-xl mb-6 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{dealFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDeal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Deal Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Fleet Solar Expansion"
                  value={dlName}
                  onChange={(e) => setDlName(e.target.value)}
                  className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Deal Value ($) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={dlValue}
                    onChange={(e) => setDlValue(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Stage *</label>
                  <select
                    value={dlStage}
                    onChange={(e) => setDlStage(e.target.value as DealStage)}
                    className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer capitalize"
                  >
                    <option value="qualification">Qualification</option>
                    <option value="proposal">Proposal</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="closed-won">Closed Won</option>
                    <option value="closed-lost">Closed Lost</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Associated Contact</label>
                  <select
                    value={dlContactId}
                    onChange={(e) => setDlContactId(e.target.value)}
                    className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                  >
                    <option value="">No specific contact</option>
                    {companyContacts.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.role || 'Contact'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Assigned Salesperson</label>
                  <select
                    value={dlSalespersonId}
                    onChange={(e) => setDlSalespersonId(e.target.value)}
                    className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                  >
                    {getActiveSalespeople(users).map((u) => (
                      <option key={u.uid} value={u.uid}>{u.displayName}</option>
                    ))}
                    {dlSalespersonId && !getActiveSalespeople(users).some(u => u.uid === dlSalespersonId) && (
                      <option value={dlSalespersonId}>{getSalespersonLabel(users, dlSalespersonId)}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-crm-border/60">
                <button
                  type="button"
                  onClick={() => setDealModalOpen(false)}
                  className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-sm border border-crm-border transition shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-primary/10"
                >
                  {editingDealId ? 'Update Deal' : 'Create Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- GEOCODING LOADER --- */}
      {isGeocoding && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-crm-card border border-crm-border p-6 rounded-2xl shadow-2xl flex flex-col items-center space-y-4 max-w-xs text-center text-crm-text animate-fade-in">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-semibold">Verifying location address...</p>
            <p className="text-xs text-crm-muted">Consulting spatial mapping databases</p>
          </div>
        </div>,
        document.body
      )}

      {/* --- DISAMBIGUATION MODAL --- */}
      {disambiguationOpen && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-crm-card border border-crm-border rounded-3xl p-6 shadow-2xl relative text-crm-text animate-scale-in">
            <button 
              onClick={() => {
                setDisambiguationOpen(false);
                setPendingCompanySave(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-crm-text mb-2">Location Disambiguation</h3>
            <p className="text-xs text-crm-muted mb-4">
              We found multiple locations matching your input. Please select the correct result to confirm your location:
            </p>

            <div className="space-y-2 mb-6">
              {disambiguationMatches.map((match, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDisambiguationMatch(match)}
                  className="w-full text-left p-3.5 bg-crm-bg hover:bg-crm-border border border-crm-border rounded-xl text-xs text-crm-text hover:text-primary transition font-medium flex items-start space-x-2.5 leading-relaxed"
                >
                  <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span>{match.display_name}</span>
                </button>
              ))}
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setDisambiguationOpen(false);
                  setPendingCompanySave(null);
                }}
                className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-xs border border-crm-border transition shadow-sm"
              >
                Cancel Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
