import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCompanyStore } from '../stores/useCompanyStore';
import { useContactStore } from '../stores/useContactStore';
import { useDealStore } from '../stores/useDealStore';
import { useNoteStore } from '../stores/useNoteStore';
import { useMeetingStore } from '../stores/useMeetingStore';
import { useAuth } from '../context/AuthContext';
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
  ExternalLink
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

  const initCompanies = useCompanyStore(state => state.initialize);
  const initContacts = useContactStore(state => state.initialize);
  const initDeals = useDealStore(state => state.initialize);
  const initNotes = useNoteStore(state => state.initialize);
  const initMeetings = useMeetingStore(state => state.initialize);

  const addNote = useNoteStore(state => state.addNote);
  const deleteNote = useNoteStore(state => state.deleteNote);
  const addMeeting = useMeetingStore(state => state.addMeeting);

  // Form note & correspondence logging
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [logType, setLogType] = useState<'note' | 'meeting'>('note');
  const [selectedContactId, setSelectedContactId] = useState('');
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

  const [meetingOutcome, setMeetingOutcome] = useState<string>(() => {
    const stored = localStorage.getItem('northstar_meeting_outcomes');
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

  useEffect(() => {
    const loadOutcomes = () => {
      const stored = localStorage.getItem('northstar_meeting_outcomes');
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
    window.addEventListener('northstar-outcomes-updated', loadOutcomes);
    return () => window.removeEventListener('northstar-outcomes-updated', loadOutcomes);
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
          className="flex items-center space-x-2 text-crm-muted hover:text-crm-text transition text-sm font-semibold"
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
  const contactIds = companyContacts.map(c => c.id);

  // Group completed meetings for company and its contacts
  const associatedMeetings = meetings.filter(m => 
    (m.companyId === id || contactIds.includes(m.contactId)) && 
    m.status === 'completed'
  );

  // Group notes for company and its contacts
  const associatedNotes = notes.filter(n => 
    (n.parentId === id && n.parentType === 'company') ||
    (contactIds.includes(n.parentId) && n.parentType === 'contact')
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
      salespersonName: 'Sales Rep',
      content: m.comments || 'Touchpoint meeting logged.',
      extra: m.outcome,
      contactName: m.contactName,
    })),
    ...associatedNotes.map(n => ({
      id: n.id,
      type: 'note' as const,
      date: n.createdAt,
      salespersonName: n.createdByName || 'Sales Representative',
      content: n.content,
      contactName: companyContacts.find(c => c.id === n.parentId)?.name,
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Find last touchpoint
  const lastTouchpoint = logItems.length > 0 ? logItems[0] : null;
  const daysSinceLastTouchpoint = lastTouchpoint 
    ? Math.max(0, Math.floor((now - new Date(lastTouchpoint.date).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

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
        <div className="flex items-center space-x-4">
          <div className="p-3.5 rounded-2xl bg-primary/10 text-primary border border-primary/25 shadow-sm">
            <Building2 className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-crm-text">{company.name}</h1>
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
              <span className="text-xs text-crm-muted">&bull; Assigned salesperson: {company.assignedSalespersonId}</span>
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
        <div className="bg-crm-card border border-crm-border p-6 rounded-2xl space-y-6 self-start shadow-sm">
          <h3 className="text-sm font-bold text-crm-muted uppercase tracking-wider">Company Profile</h3>

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
                {company.primaryOwner || 'John Salesperson'}
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
              <p className="text-sm text-crm-text mt-1 flex items-center space-x-2">
                <Phone className="h-4 w-4 text-crm-muted" />
                <span>{company.phone || 'No phone recorded'}</span>
              </p>
            </div>

            {/* Split Address formatted to Global standards */}
            <div>
              <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider">Office Address</p>
              <div className="text-xs text-crm-muted mt-1.5 flex items-start space-x-2 leading-relaxed bg-crm-bg p-3 rounded-xl border border-crm-border">
                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p><span className="font-semibold">Street:</span> {company.street || 'N/A'}</p>
                  <p><span className="font-semibold">Suburb:</span> {company.suburb || 'N/A'}</p>
                  <p><span className="font-semibold">State:</span> {company.state || 'N/A'}</p>
                  <p><span className="font-semibold">Country:</span> {company.country || 'N/A'}</p>
                  {company.postcode && <p><span className="font-semibold">Postcode:</span> {company.postcode}</p>}
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
            </div>

            {companyContacts.length === 0 ? (
              <p className="text-crm-muted text-sm py-4 text-center border border-dashed border-crm-border rounded-xl">
                No contacts associated with this company yet
              </p>
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
                      <p className="text-xs text-crm-muted">{c.role} &bull; {c.email} &bull; <strong className="text-primary font-bold">Tier {c.tier}</strong></p>
                    </div>
                    <Link 
                      to={`/contacts/${c.id}`} 
                      className="p-1 rounded bg-crm-card text-crm-muted hover:text-crm-text border border-crm-border hover:border-crm-muted/30 transition shadow-xs"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
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
            </div>

            {companyDeals.length === 0 ? (
              <p className="text-crm-muted text-sm py-4 text-center border border-dashed border-crm-border rounded-xl">
                No active deals linked to this company yet
              </p>
            ) : (
              <div className="space-y-2.5">
                {companyDeals.map(d => (
                  <div 
                    key={d.id}
                    className="flex justify-between items-center bg-crm-bg/40 border border-crm-border p-4 rounded-xl shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-semibold text-crm-text">{d.name}</p>
                      <p className="text-xs text-crm-muted capitalize">Stage: <strong className="text-primary font-semibold">{d.stage}</strong></p>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      ${d.value.toLocaleString()}
                    </span>
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
    </div>
  );
};
