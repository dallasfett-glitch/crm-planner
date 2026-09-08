import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useContactStore, type Contact } from '../stores/useContactStore';
import { useCompanyStore } from '../stores/useCompanyStore';
import { useNoteStore } from '../stores/useNoteStore';
import { useMeetingStore } from '../stores/useMeetingStore';
import { useUserStore } from '../stores/useUserStore';
import { useAuth } from '../context/AuthContext';
import { getSalespersonLabel, getActiveSalespeople } from '../utils/userHelpers';
import { AddressForm } from '../components/AddressForm';
import { COUNTRY_STATES } from '../utils/addressConstants';
import { geocodeStructuredAddress, type GeocodingMatch } from '../utils/geocoding';
import { 
  User, 
  Building2, 
  Mail, 
  Phone, 
  ArrowLeft, 
  MessageSquare,
  Plus,
  Trash2,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  Edit,
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';

export const ContactDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [now] = useState(() => Date.now());

  // Load stores
  const contacts = useContactStore(state => state.contacts);
  const notes = useNoteStore(state => state.notes);
  const meetings = useMeetingStore(state => state.meetings);
  const companies = useCompanyStore(state => state.companies);
  const users = useUserStore(state => state.users);

  const initContacts = useContactStore(state => state.initialize);
  const initNotes = useNoteStore(state => state.initialize);
  const initMeetings = useMeetingStore(state => state.initialize);
  const initCompanies = useCompanyStore(state => state.initialize);

  const updateContact = useContactStore(state => state.updateContact);
  const addNote = useNoteStore(state => state.addNote);
  const deleteNote = useNoteStore(state => state.deleteNote);
  const addMeeting = useMeetingStore(state => state.addMeeting);

  // Form State
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [logType, setLogType] = useState<'note' | 'meeting'>('note');
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

  // Edit Contact Modal state
  const [editContactModalOpen, setEditContactModalOpen] = useState(false);
  const [ctName, setCtName] = useState('');
  const [ctEmail, setCtEmail] = useState('');
  const [ctPhone, setCtPhone] = useState('');
  const [ctRole, setCtRole] = useState('');
  const [ctStatus, setCtStatus] = useState<'prospect' | 'client' | 'inactive'>('prospect');
  const [ctTier, setCtTier] = useState<'A' | 'B' | 'C'>('B');
  const [ctCompanyId, setCtCompanyId] = useState('');
  const [ctPrimaryOwner, setCtPrimaryOwner] = useState('Rebecca Fett');
  const [ctStreet, setCtStreet] = useState('');
  const [ctSuburb, setCtSuburb] = useState('');
  const [ctState, setCtState] = useState('');
  const [ctCountry, setCtCountry] = useState('');
  const [ctPostcode, setCtPostcode] = useState('');
  const [ctLatitude, setCtLatitude] = useState<number | undefined>(undefined);
  const [ctLongitude, setCtLongitude] = useState<number | undefined>(undefined);
  const [contactFormError, setContactFormError] = useState<string | null>(null);

  // Geocoding Intercept State
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [disambiguationOpen, setDisambiguationOpen] = useState(false);
  const [disambiguationMatches, setDisambiguationMatches] = useState<GeocodingMatch[]>([]);
  const [pendingContactSave, setPendingContactSave] = useState<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> | null>(null);

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
    const unsubCont = initContacts();
    const unsubNotes = initNotes();
    const unsubMeet = initMeetings();
    const unsubComp = initCompanies();

    return () => {
      unsubCont();
      unsubNotes();
      unsubMeet();
      unsubComp();
    };
  }, [initContacts, initNotes, initMeetings, initCompanies]);

  const contact = contacts.find(c => c.id === id);
  const company = companies.find(c => c.id === contact?.companyId);

  if (!contact) {
    return (
      <div className="space-y-6 animate-fade-in text-crm-text">
        <button 
          onClick={() => navigate('/contacts')}
          className="flex items-center space-x-2 text-crm-muted hover:text-crm-text transition text-sm font-semibold border border-transparent hover:border-crm-border hover:bg-crm-card px-2.5 py-1 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to contacts</span>
        </button>
        <div className="text-center py-20 bg-crm-card border border-crm-border rounded-2xl">
          <User className="h-12 w-12 text-crm-muted mx-auto mb-4" />
          <p className="text-crm-text font-bold text-lg">Contact not found</p>
          <p className="text-crm-muted text-sm mt-1">The contact record you are looking for does not exist.</p>
        </div>
      </div>
    );
  }

  // Filter associated items
  const contactNotes = notes.filter(n => n.parentId === id && n.parentType === 'contact');
  const completedMeetings = meetings.filter(m => m.contactId === id && m.status === 'completed');

  // Map them to a unified format for history logs
  interface LogItem {
    id: string;
    type: 'meeting' | 'note';
    date: string;
    salespersonName: string;
    content: string;
    extra?: string; // outcome for meetings
  }

  const logItems: LogItem[] = [
    ...completedMeetings.map(m => ({
      id: m.id,
      type: 'meeting' as const,
      date: m.completedAt || m.scheduledAt,
      salespersonName: getSalespersonLabel(users, m.salespersonId),
      content: m.comments || 'Touchpoint meeting logged.',
      extra: m.outcome,
    })),
    ...contactNotes.map(n => ({
      id: n.id,
      type: 'note' as const,
      date: n.createdAt,
      salespersonName: getSalespersonLabel(users, n.createdBy || n.createdByName),
      content: n.content,
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Find last touchpoint
  const lastTouchpoint = logItems.length > 0 ? logItems[0] : null;
  const daysSinceLastTouchpoint = lastTouchpoint 
    ? Math.max(0, Math.floor((now - new Date(lastTouchpoint.date).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  // Contact meetings list still used for standard scheduling timeline
  const contactMeetings = meetings
    .filter(m => m.contactId === id)
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  // --- Edit Contact Handlers ---
  const openEditContactModal = () => {
    setCtName(contact.name);
    setCtEmail(contact.email || '');
    setCtPhone(contact.phone || '');
    setCtRole(contact.role || '');
    setCtStatus(contact.status);
    setCtTier(contact.tier || 'B');
    setCtCompanyId(contact.companyId || '');
    setCtPrimaryOwner(contact.primaryOwner === 'John Salesperson' ? 'Rebecca Fett' : (contact.primaryOwner || 'Rebecca Fett'));
    setCtStreet(contact.street || '');
    setCtSuburb(contact.suburb || '');
    setCtState(contact.state || '');
    setCtCountry(contact.country || '');
    setCtPostcode(contact.postcode || '');
    setCtLatitude(contact.latitude);
    setCtLongitude(contact.longitude);
    setContactFormError(null);
    setEditContactModalOpen(true);
  };

  const proceedWithContactSave = async (data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await updateContact(contact.id, data);
      setEditContactModalOpen(false);
    } catch (err: unknown) {
      setContactFormError(err instanceof Error ? err.message : 'Error updating contact profile.');
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactFormError(null);

    if (!ctName.trim()) {
      setContactFormError('Please enter a name.');
      return;
    }

    const selectedComp = companies.find(c => c.id === ctCompanyId);
    const companyName = selectedComp ? selectedComp.name : contact.companyName;

    const hasAddress = !!(ctStreet.trim() || ctSuburb.trim() || ctState.trim() || ctCountry.trim() || ctPostcode.trim());
    if (hasAddress && !ctSuburb.trim()) {
      setContactFormError('Suburb/City is required when entering address details.');
      return;
    }

    const contactData = {
      name: ctName.trim(),
      email: ctEmail.trim(),
      phone: ctPhone.trim(),
      role: ctRole.trim(),
      status: ctStatus,
      tier: ctTier,
      companyId: ctCompanyId || contact.companyId,
      companyName: companyName,
      assignedSalespersonId: contact.assignedSalespersonId || user?.uid || '',
      primaryOwner: ctPrimaryOwner,
      street: ctStreet.trim(),
      suburb: ctSuburb.trim(),
      state: ctState.trim(),
      country: ctCountry.trim(),
      postcode: ctPostcode.trim(),
      latitude: ctLatitude,
      longitude: ctLongitude,
    };

    if (hasAddress && (ctLatitude === undefined || ctLongitude === undefined)) {
      setIsGeocoding(true);
      try {
        const matches = await geocodeStructuredAddress({
          street: ctStreet.trim(),
          suburb: ctSuburb.trim(),
          state: ctState.trim(),
          country: ctCountry.trim(),
          postcode: ctPostcode.trim(),
        });

        if (!matches || matches.length === 0) {
          setContactFormError('Geocoding verification failed: No matching locations found. Please check spelling or details.');
          setIsGeocoding(false);
          return;
        }

        const topMatch = matches[0];
        const confidence = topMatch.importance || 0;

        if (confidence >= 0.90 || matches.length === 1) {
          const lat = parseFloat(topMatch.lat);
          const lon = parseFloat(topMatch.lon);
          contactData.latitude = isNaN(lat) ? undefined : lat;
          contactData.longitude = isNaN(lon) ? undefined : lon;
          await proceedWithContactSave(contactData);
        } else {
          setDisambiguationMatches(matches);
          setPendingContactSave(contactData);
          setDisambiguationOpen(true);
        }
      } catch (err) {
        console.error(err);
        await proceedWithContactSave(contactData);
      } finally {
        setIsGeocoding(false);
      }
    } else {
      await proceedWithContactSave(contactData);
    }
  };

  const handleSelectDisambiguationMatch = async (match: GeocodingMatch) => {
    if (!pendingContactSave) return;

    const lat = parseFloat(match.lat);
    const lon = parseFloat(match.lon);
    const addr = match.address || {};

    const houseNumber = addr.house_number ? `${addr.house_number} ` : '';
    const road = addr.road || '';
    const streetVal = `${houseNumber}${road}`.trim() || match.display_name.split(',')[0];
    const cityOrSuburb = addr.suburb || addr.city || addr.town || addr.village || pendingContactSave.suburb;
    
    const rawCountryCode = (addr.country_code || '').toUpperCase();
    let countryVal = pendingContactSave.country;
    if (rawCountryCode) countryVal = rawCountryCode;

    const rawState = addr.state || addr.province || '';
    const stateVal = (countryVal && COUNTRY_STATES[countryVal])
      ? (COUNTRY_STATES[countryVal].find(
          s => s.value.toLowerCase() === rawState.toLowerCase().trim() || s.label.toLowerCase().includes(rawState.toLowerCase().trim())
        )?.value || rawState)
      : (rawState || pendingContactSave.state);

    const postcodeVal = addr.postcode || pendingContactSave.postcode;

    const finalData = {
      ...pendingContactSave,
      street: streetVal,
      suburb: cityOrSuburb,
      state: stateVal,
      country: countryVal,
      postcode: postcodeVal,
      latitude: isNaN(lat) ? undefined : lat,
      longitude: isNaN(lon) ? undefined : lon,
    };

    setDisambiguationOpen(false);
    setPendingContactSave(null);
    await proceedWithContactSave(finalData);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !id) return;

    setNoteLoading(true);
    try {
      if (logType === 'note') {
        await addNote({
          content: newNoteContent.trim(),
          parentId: id,
          parentType: 'contact',
          createdBy: user?.uid || '',
          createdByName: user?.displayName || 'Unknown User',
        });
      } else {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        await addMeeting({
          contactId: id,
          contactName: contact.name,
          companyId: contact.companyId,
          companyName: contact.companyName,
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
      {/* Page Header */}
      <div>
        <button 
          onClick={() => navigate('/contacts')}
          className="flex items-center space-x-2 text-crm-muted hover:text-crm-text transition text-sm font-semibold mb-4 border border-transparent hover:border-crm-border hover:bg-crm-card px-2.5 py-1 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to contacts</span>
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary font-bold text-lg shadow-inner">
              {contact.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-crm-text">{contact.name}</h1>
                <button
                  onClick={openEditContactModal}
                  className="p-1.5 rounded-xl bg-crm-card hover:bg-crm-bg border border-crm-border hover:border-primary text-crm-muted hover:text-primary transition shadow-xs flex items-center space-x-1 text-xs font-semibold px-2.5"
                  title="Edit Contact Profile"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Edit Profile</span>
                </button>
              </div>
              <p className="text-xs text-crm-muted mt-0.5">Contact reference ID: {contact.id}</p>
            </div>
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
              <User className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-crm-muted uppercase tracking-wider">Last Interaction / Visit</p>
              <h4 className="text-sm font-bold text-crm-text mt-1.5 leading-relaxed">
                {lastTouchpoint ? (
                  <span>
                    Last visited <strong className="text-primary font-extrabold">{daysSinceLastTouchpoint}</strong> days ago on{' '}
                    <span className="font-semibold text-crm-text">
                      {new Date(lastTouchpoint.date).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>{' '}
                    by <strong className="font-semibold text-crm-text">{lastTouchpoint.salespersonName}</strong> ({lastTouchpoint.type === 'meeting' ? 'Completed Meeting' : 'Logged Note'})
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
        
        {/* Left Column: Contact Profile Info */}
        <div className="bg-crm-card border border-crm-border p-6 rounded-2xl space-y-6 self-start shadow-sm">
          <div className="flex justify-between items-center border-b border-crm-border/60 pb-3">
            <h3 className="text-sm font-bold text-crm-muted uppercase tracking-wider">Contact Details</h3>
            <button
              onClick={openEditContactModal}
              className="text-xs text-primary hover:underline font-bold flex items-center space-x-1"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>Edit Details</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider">Company</p>
              <Link 
                to={`/companies/${contact.companyId}`}
                className="text-sm font-bold text-primary hover:text-primary-hover hover:underline mt-1 flex items-center space-x-1.5"
              >
                <Building2 className="h-4 w-4 text-crm-muted" />
                <span>{contact.companyName}</span>
              </Link>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider">Primary Owner</p>
              <div className="text-sm font-semibold text-crm-text mt-1 capitalize bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl inline-block shadow-xs">
                {contact.primaryOwner === 'John Salesperson' ? 'Rebecca Fett' : (contact.primaryOwner || 'Rebecca Fett')}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider">Role / Title</p>
              <p className="text-sm text-crm-text mt-1 font-semibold">{contact.role || 'N/A'}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider">Email Address</p>
              <a 
                href={`mailto:${contact.email}`}
                className="text-sm text-primary hover:text-primary-hover font-semibold hover:underline mt-1 flex items-center space-x-2"
              >
                <Mail className="h-4 w-4 text-crm-muted" />
                <span>{contact.email || 'No email recorded'}</span>
              </a>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider">Phone</p>
              <a 
                href={`tel:${contact.phone}`}
                className="text-sm text-crm-text hover:text-primary font-semibold mt-1 flex items-center space-x-2"
              >
                <Phone className="h-4 w-4 text-crm-muted" />
                <span>{contact.phone || 'No phone recorded'}</span>
              </a>
            </div>

            {/* Custom Location / Override Address if provided */}
            <div>
              <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider">Location / Address</p>
              <div className="text-xs text-crm-muted mt-1.5 flex items-start space-x-2 leading-relaxed bg-crm-bg p-3 rounded-xl border border-crm-border">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {contact.street || contact.suburb ? (
                    <>
                      {contact.street && <p><span className="font-semibold text-crm-text">Street:</span> {contact.street}</p>}
                      {contact.suburb && <p><span className="font-semibold text-crm-text">Suburb:</span> {contact.suburb}</p>}
                      {contact.state && <p><span className="font-semibold text-crm-text">State:</span> {contact.state}</p>}
                      {contact.country && <p><span className="font-semibold text-crm-text">Country:</span> {contact.country}</p>}
                      {contact.postcode && <p><span className="font-semibold text-crm-text">Postcode:</span> {contact.postcode}</p>}
                    </>
                  ) : company ? (
                    <>
                      <p className="text-[10px] font-bold text-primary uppercase">Inherited from Company</p>
                      <p><span className="font-semibold text-crm-text">Street:</span> {company.street || 'N/A'}</p>
                      <p><span className="font-semibold text-crm-text">Suburb:</span> {company.suburb || 'N/A'}</p>
                      <p><span className="font-semibold text-crm-text">State:</span> {company.state || 'N/A'}</p>
                    </>
                  ) : (
                    <p>No address recorded</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interaction Log & Schedule */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Correspondence & Internal Notes Widget */}
          <div className="bg-crm-card border border-crm-border p-6 rounded-2xl space-y-6 shadow-sm">
            <h3 className="text-sm font-bold text-crm-muted uppercase tracking-wider flex items-center space-x-2">
              <MessageSquare className="h-4.5 w-4.5 text-primary" />
              <span>Activity & Correspondence Log</span>
            </h3>

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
                  onClick={() => setLogType('meeting')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${logType === 'meeting' ? 'bg-primary text-white shadow-sm' : 'text-crm-muted hover:text-crm-text'}`}
                >
                  Log Completed Visit/Meeting
                </button>
              </div>

              {logType === 'meeting' && (
                <div className="bg-crm-bg/40 p-4 border border-crm-border rounded-2xl animate-fade-in">
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
              )}

              <textarea
                placeholder={logType === 'note' ? "Write a comment or interaction log to attach to this contact..." : "Enter details/comments of what was discussed during this salesperson visit..."}
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

            <div className="space-y-4 pt-4 border-t border-crm-border">
              {logItems.length === 0 ? (
                <p className="text-crm-muted text-xs italic text-center py-4">No notes or correspondence logged yet for this contact.</p>
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
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                        item.type === 'meeting'
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-500/10 border-slate-500/25 text-slate-600 dark:text-slate-400'
                      }`}>
                        {item.type === 'meeting' ? 'Completed Meeting' : 'Internal Note'}
                      </span>
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

          {/* Meeting Schedule Timeline */}
          <div className="bg-crm-card border border-crm-border p-6 rounded-2xl space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-crm-muted uppercase tracking-wider flex items-center space-x-2">
              <Calendar className="h-4.5 w-4.5 text-primary" />
              <span>Meeting History & Schedule ({contactMeetings.length})</span>
            </h3>

            {contactMeetings.length === 0 ? (
              <p className="text-crm-muted text-sm py-4 text-center border border-dashed border-crm-border rounded-xl">
                No meetings scheduled or recorded for this contact
              </p>
            ) : (
              <div className="space-y-3">
                {contactMeetings.map(m => (
                  <div key={m.id} className="bg-crm-bg/40 border border-crm-border p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2.5 rounded-xl border ${
                        m.status === 'completed' 
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' 
                          : m.status === 'suggested'
                          ? 'bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400'
                          : 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
                      }`}>
                        {m.status === 'completed' ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-crm-text capitalize">{m.status} Visit / Meeting</p>
                        <p className="text-xs text-crm-muted mt-0.5">
                          Month: {m.month} &bull; {new Date(m.scheduledAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        {m.comments && <p className="text-xs text-crm-text/80 mt-1 italic font-medium">"{m.comments}"</p>}
                      </div>
                    </div>
                    {m.outcome && (
                      <span className="text-xs bg-crm-bg border border-crm-border px-3 py-1 rounded-full font-bold text-primary capitalize">
                        {m.outcome}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* --- EDIT CONTACT MODAL (Portaled) --- */}
      {editContactModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-950/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="w-full max-w-3xl bg-crm-card border border-crm-border rounded-3xl p-6 md:p-8 shadow-2xl relative text-crm-text my-auto max-h-[88vh] overflow-y-auto scrollbar-thin animate-scale-in">
            <button 
              type="button"
              onClick={() => setEditContactModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-xl text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-crm-text">Edit Contact Details</h3>
                <p className="text-xs text-crm-muted mt-0.5">Update contact information and location</p>
              </div>
            </div>

            {contactFormError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold p-3.5 rounded-xl mb-6 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{contactFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveContact} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Contact Information</h4>

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
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Company Association</label>
                      <select
                        value={ctCompanyId}
                        onChange={(e) => setCtCompanyId(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                      >
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Lead Status</label>
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

                <div className="space-y-4 bg-crm-bg/20 p-5 rounded-2xl border border-crm-border">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Custom Location (Optional Override)</h4>
                  <AddressForm
                    value={{ 
                      street: ctStreet, 
                      suburb: ctSuburb, 
                      state: ctState, 
                      country: ctCountry, 
                      postcode: ctPostcode, 
                      latitude: ctLatitude, 
                      longitude: ctLongitude 
                    }}
                    onChange={(val) => {
                      setCtStreet(val.street);
                      setCtSuburb(val.suburb);
                      setCtState(val.state);
                      setCtCountry(val.country);
                      setCtPostcode(val.postcode);
                      setCtLatitude(val.latitude);
                      setCtLongitude(val.longitude);
                    }}
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-crm-border/60">
                <button
                  type="button"
                  onClick={() => setEditContactModalOpen(false)}
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
                setPendingContactSave(null);
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
                  setPendingContactSave(null);
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
