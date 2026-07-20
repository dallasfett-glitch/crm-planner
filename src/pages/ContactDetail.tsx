import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useContactStore } from '../stores/useContactStore';
import { useCompanyStore } from '../stores/useCompanyStore';
import { useNoteStore } from '../stores/useNoteStore';
import { useMeetingStore } from '../stores/useMeetingStore';
import { useAuth } from '../context/AuthContext';
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
  MapPin
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

  const initContacts = useContactStore(state => state.initialize);
  const initNotes = useNoteStore(state => state.initialize);
  const initMeetings = useMeetingStore(state => state.initialize);
  const initCompanies = useCompanyStore(state => state.initialize);

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

  if (!contact) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button 
          onClick={() => navigate('/contacts')}
          className="flex items-center space-x-2 text-crm-muted hover:text-crm-text transition text-sm font-semibold"
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
  
  // Get all completed meetings for this contact
  const completedMeetings = meetings.filter(m => m.contactId === id && m.status === 'completed');

  // Map them to a unified format
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
      salespersonName: 'Sales Rep',
      content: m.comments || 'Touchpoint meeting logged.',
      extra: m.outcome,
    })),
    ...contactNotes.map(n => ({
      id: n.id,
      type: 'note' as const,
      date: n.createdAt,
      salespersonName: n.createdByName || 'Sales Representative',
      content: n.content,
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Find last touchpoint
  const lastTouchpoint = logItems.length > 0 ? logItems[0] : null;
  const daysSinceLastTouchpoint = lastTouchpoint 
    ? Math.max(0, Math.floor((now - new Date(lastTouchpoint.date).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  // Contact meetings list still used for standard scheduling timeline (all: pending, suggested, completed)
  const contactMeetings = meetings
    .filter(m => m.contactId === id)
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

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
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary font-bold text-lg shadow-inner">
            {contact.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-crm-text">{contact.name}</h1>
            <p className="text-xs text-crm-muted mt-0.5">Contact reference ID: {contact.id}</p>
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
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-crm-muted uppercase tracking-wider">Contact Details</h3>
            <div className="flex items-center space-x-1.5">
              <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                contact.status === 'client' 
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' 
                  : contact.status === 'prospect'
                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
                  : 'bg-crm-bg border-crm-border text-crm-muted'
              }`}>
                {contact.status}
              </span>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                contact.tier === 'A' 
                  ? 'bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400' 
                  : contact.tier === 'B'
                  ? 'bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400'
                  : 'bg-slate-500/10 border-slate-500/25 text-slate-600 dark:text-slate-400'
              }`}>
                Tier {contact.tier}
              </span>
            </div>
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
                {contact.primaryOwner || 'John Salesperson'}
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
                className="text-sm text-crm-text hover:text-primary mt-1 flex items-center space-x-2 transition font-medium"
              >
                <Mail className="h-4 w-4 text-crm-muted" />
                <span>{contact.email}</span>
              </a>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider">Phone</p>
              {contact.phone ? (
                <a 
                  href={`tel:${contact.phone}`}
                  className="text-sm text-crm-text hover:text-primary mt-1 flex items-center space-x-2 transition font-medium"
                >
                  <Phone className="h-4 w-4 text-crm-muted" />
                  <span>{contact.phone}</span>
                </a>
              ) : (
                <p className="text-xs text-crm-muted italic mt-1">No phone number</p>
              )}
            </div>

            <div className="border-t border-crm-border pt-4 mt-4">
              {(() => {
                const hasCustom = contact.street || contact.suburb || contact.state;
                const company = companies.find(c => c.id === contact.companyId);
                
                const addressText = hasCustom 
                  ? [contact.street, contact.suburb, contact.state, contact.postcode, contact.country].filter(Boolean).join(', ')
                  : company
                  ? [company.street, company.suburb, company.state, company.postcode, company.country].filter(Boolean).join(', ')
                  : 'No address resolved';
                  
                return (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider flex items-center justify-between">
                      <span>Location Address</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                        hasCustom 
                          ? 'bg-primary/10 border-primary/20 text-primary' 
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                      }`}>
                        {hasCustom ? 'Custom' : 'Company Fallback'}
                      </span>
                    </p>
                    <p className="text-xs text-crm-text flex items-start space-x-2 font-medium leading-relaxed">
                      <MapPin className="h-4 w-4 text-crm-muted shrink-0 mt-0.5" />
                      <span>{addressText}</span>
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Right Column: Meetings History and Notes */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Critical Feature: Meeting History List */}
          <div className="bg-crm-card border border-crm-border p-6 rounded-2xl shadow-sm">
            <h3 className="text-sm font-bold text-crm-muted uppercase tracking-wider flex items-center space-x-2 mb-4">
              <Calendar className="h-4.5 w-4.5 text-primary" />
              <span>Meeting History Timeline ({contactMeetings.length})</span>
            </h3>

            {contactMeetings.length === 0 ? (
              <p className="text-crm-muted text-sm py-4 text-center border border-dashed border-crm-border rounded-xl">
                No scheduled meetings or meeting logs found for this contact.
              </p>
            ) : (
              <div className="space-y-4">
                {contactMeetings.map(meeting => (
                  <div 
                    key={meeting.id}
                    className={`border p-4 rounded-xl space-y-3 shadow-xs ${
                      meeting.status === 'suggested'
                        ? 'bg-purple-500/5 border-dashed border-purple-500/30'
                        : 'bg-crm-bg/40 border-crm-border'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          {meeting.status === 'completed' ? (
                            <CheckCircle className="h-4 w-4 text-primary" />
                          ) : (
                            <Clock className="h-4 w-4 text-crm-muted" />
                          )}
                          <span className="text-sm font-semibold text-crm-text">
                            {new Date(meeting.scheduledAt).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {meeting.status === 'suggested' && (
                          <span className="inline-block mt-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                            Suggested by AI
                          </span>
                        )}
                        <p className="text-xs text-crm-muted mt-1">Scheduled for: {meeting.month}</p>
                      </div>
                      <div>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                          meeting.status === 'completed' 
                            ? 'bg-primary/10 border-primary/25 text-primary' 
                            : meeting.status === 'suggested'
                            ? 'bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400'
                            : 'bg-crm-bg border-crm-border text-crm-muted'
                        }`}>
                          {meeting.status}
                        </span>
                      </div>
                    </div>

                    {/* AI Suggestion Reason Context */}
                    {meeting.status === 'suggested' && meeting.whyContext && (
                      <div className="text-xs text-purple-700 dark:text-purple-300 font-semibold italic bg-purple-500/5 p-2 rounded border border-purple-500/10">
                        {meeting.whyContext}
                      </div>
                    )}

                    {/* Outcome Tag */}
                    {meeting.status === 'completed' && meeting.outcome && (
                      <div>
                        <span className="text-xs bg-crm-bg border border-crm-border text-primary font-semibold px-2 py-0.5 rounded capitalize">
                          Outcome: {meeting.outcome}
                        </span>
                      </div>
                    )}

                    {/* comments */}
                    {meeting.comments ? (
                      <div className="bg-crm-bg p-3 rounded-lg border border-crm-border">
                        <p className="text-xs font-bold text-crm-muted uppercase tracking-wider mb-1">Meeting Notes & Comments</p>
                        <p className="text-xs text-crm-text leading-relaxed whitespace-pre-wrap font-medium">{meeting.comments}</p>
                      </div>
                    ) : (
                      meeting.status === 'completed' && (
                        <p className="text-xs text-crm-muted italic">No notes provided for this meeting.</p>
                      )
                    )}
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

            {/* Correspondence form with quick selector */}
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

            {/* Unified Timeline list */}
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

        </div>

      </div>
    </div>
  );
};
