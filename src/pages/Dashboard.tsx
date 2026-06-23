import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useContactStore } from '../stores/useContactStore';
import { useDealStore } from '../stores/useDealStore';
import { useMeetingStore } from '../stores/useMeetingStore';
import { 
  Users, 
  Briefcase, 
  DollarSign, 
  Calendar, 
  Target, 
  TrendingUp, 
  ChevronRight,
  CheckCircle,
  Clock
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load stores
  const contacts = useContactStore(state => state.contacts);
  const deals = useDealStore(state => state.deals);
  const meetings = useMeetingStore(state => state.meetings);

  const initContacts = useContactStore(state => state.initialize);
  const initDeals = useDealStore(state => state.initialize);
  const initMeetings = useMeetingStore(state => state.initialize);

  useEffect(() => {
    const unsubContacts = initContacts();
    const unsubDeals = initDeals();
    const unsubMeetings = initMeetings();

    return () => {
      unsubContacts();
      unsubDeals();
      unsubMeetings();
    };
  }, [initContacts, initDeals, initMeetings]);

  // Current month string YYYY-MM
  const d = new Date();
  const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthReadable = d.toLocaleString('default', { month: 'long', year: 'numeric' });

  // 1. Total Contacts count
  const totalContactsCount = contacts.length;

  // 2. Open deals (qualification, proposal, negotiation)
  const openDeals = deals.filter(d => d.stage !== 'closed-won' && d.stage !== 'closed-lost');
  const openDealsCount = openDeals.length;

  // 3. Total Deal Value of Open Deals
  const totalOpenDealsValue = openDeals.reduce((sum, d) => sum + d.value, 0);

  const canViewAllSchedules = user?.role === 'admin' || user?.permissions?.canViewAllSchedules === true;

  // Filter meetings for logged-in salesperson in current month (or all if admin/view-all)
  const myMeetingsThisMonth = meetings.filter(m => 
    (canViewAllSchedules || m.salespersonId === user?.uid) && 
    m.month === currentMonthStr
  );

  const completedMeetingsCount = myMeetingsThisMonth.filter(m => m.status === 'completed').length;
  const totalMeetingsCount = myMeetingsThisMonth.length;
  const meetingProgressPct = totalMeetingsCount > 0 ? Math.round((completedMeetingsCount / totalMeetingsCount) * 100) : 0;

  // Prospects to meet this month (system-wide meetings with prospects in current month)
  const prospectsToMeetThisMonth = meetings.filter(m => {
    if (m.month !== currentMonthStr) return false;
    const contact = contacts.find(c => c.id === m.contactId);
    return contact?.status === 'prospect';
  }).length;

  // Calculate Pipeline by Stage
  const stageStats = {
    qualification: { count: 0, value: 0 },
    proposal: { count: 0, value: 0 },
    negotiation: { count: 0, value: 0 },
    'closed-won': { count: 0, value: 0 },
    'closed-lost': { count: 0, value: 0 },
  };

  deals.forEach(deal => {
    if (stageStats[deal.stage]) {
      stageStats[deal.stage].count += 1;
      stageStats[deal.stage].value += deal.value;
    }
  });

  const isToday = (dateString: string) => {
    const today = new Date();
    const date = new Date(dateString);
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const todayMeetings = myMeetingsThisMonth.filter(m => isToday(m.scheduledAt) && m.status !== 'completed');
  const otherMeetings = myMeetingsThisMonth.filter(m => !(isToday(m.scheduledAt) && m.status !== 'completed'));

  return (
    <div className="space-y-8 animate-fade-in text-crm-text">
      {/* Welcome banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-crm-card border border-crm-border p-6 rounded-3xl relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-crm-text">
            Welcome back, <span className="bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">{user?.displayName}</span>
          </h1>
          <p className="text-crm-muted text-sm mt-1 font-medium">
            Here is your Northstar sales performance summary for <strong className="text-crm-text font-bold">{currentMonthReadable}</strong>.
          </p>
        </div>
        <button
          onClick={() => navigate('/meetings')}
          className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-primary/10"
        >
          <span>Open Meeting Planner</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        
        {/* Card 1: Total Contacts */}
        <div className="bg-crm-card border border-crm-border p-5 rounded-2xl flex flex-col justify-between hover:border-primary/30 transition shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-crm-muted uppercase tracking-wider">Total Contacts</span>
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/15">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-crm-text">{totalContactsCount}</p>
            <p className="text-xs text-crm-muted mt-1 font-medium">CRM directory database</p>
          </div>
        </div>

        {/* Card 2: Open Deals */}
        <div className="bg-crm-card border border-crm-border p-5 rounded-2xl flex flex-col justify-between hover:border-primary/30 transition shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-crm-muted uppercase tracking-wider">Open Deals</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-crm-text">{openDealsCount}</p>
            <p className="text-xs text-crm-muted mt-1 font-medium">Active opportunities</p>
          </div>
        </div>

        {/* Card 3: Total Deal Value */}
        <div className="bg-crm-card border border-crm-border p-5 rounded-2xl flex flex-col justify-between hover:border-primary/30 transition shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-crm-muted uppercase tracking-wider">Open Deal Value</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-crm-text">${totalOpenDealsValue.toLocaleString()}</p>
            <p className="text-xs text-crm-muted mt-1.5 font-medium">Pipeline total value</p>
          </div>
        </div>

        {/* Card 4: Meeting progress */}
        <div className="bg-crm-card border border-crm-border p-5 rounded-2xl flex flex-col justify-between hover:border-primary/30 transition shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-crm-muted uppercase tracking-wider">Meetings Completed</span>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <p className="text-2xl font-extrabold text-crm-text">{completedMeetingsCount} / {totalMeetingsCount}</p>
              <span className="text-xs font-bold text-primary">{meetingProgressPct}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-crm-bg rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500" 
                style={{ width: `${meetingProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 5: Prospects to meet */}
        <div className="bg-crm-card border border-crm-border p-5 rounded-2xl flex flex-col justify-between hover:border-primary/30 transition shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-crm-muted uppercase tracking-wider">Prospects To Meet</span>
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-crm-text">{prospectsToMeetThisMonth}</p>
            <p className="text-xs text-crm-muted mt-1 font-medium">Pending target contacts</p>
          </div>
        </div>

      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* List of Scheduled Meetings widget */}
        <div className="bg-crm-card border border-crm-border p-6 rounded-2xl lg:col-span-2 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-crm-text">Your Meetings for {currentMonthReadable}</h3>
                <p className="text-xs text-crm-muted mt-0.5 font-medium">Quick list of schedule entries for the month</p>
              </div>
              <span className="text-xs font-bold bg-crm-bg px-3 py-1 rounded-full border border-crm-border text-primary shadow-inner">
                {myMeetingsThisMonth.length} Assigned
              </span>
            </div>

            {myMeetingsThisMonth.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-crm-border rounded-xl">
                <Calendar className="h-10 w-10 text-crm-muted mx-auto mb-3" />
                <p className="text-crm-text text-sm font-bold">No scheduled meetings for this month</p>
                <p className="text-crm-muted text-xs mt-1">Visit the Meeting Planner to assign clients/prospects</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Today's Agenda Section */}
                {todayMeetings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider flex items-center space-x-1.5 px-1">
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                      <span>Today's Priority Agenda</span>
                    </h4>
                    <div className="space-y-3">
                      {todayMeetings.map(meeting => (
                        <div 
                          key={meeting.id} 
                          className="flex justify-between items-center border-2 border-primary bg-primary/[0.03] p-4 rounded-xl shadow-md shadow-primary/5 text-crm-text"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="p-2 rounded-lg bg-primary/20 text-primary border border-primary/25">
                              <Clock className="h-5 w-5 animate-pulse" />
                            </div>
                            <div>
                              <Link 
                                to={`/contacts/${meeting.contactId}`}
                                className="text-sm font-bold text-crm-text hover:text-primary transition"
                              >
                                {meeting.contactName}
                              </Link>
                              <p className="text-xs text-crm-muted font-medium">
                                {meeting.companyName} &bull; <strong className="text-primary font-bold">{new Date(meeting.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</strong>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 animate-pulse">
                              Due Today
                            </span>
                            {meeting.status === 'suggested' && (
                              <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-600 dark:text-purple-400">
                                Suggested
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remaining Month's Schedule */}
                <div className="space-y-2">
                  {todayMeetings.length > 0 && otherMeetings.length > 0 && (
                    <h4 className="text-xs font-bold text-crm-muted uppercase tracking-wider px-1 pt-2">
                      Remaining Schedule This Month
                    </h4>
                  )}
                  <div className="space-y-3">
                    {otherMeetings.slice(0, todayMeetings.length > 0 ? 3 : 4).map(meeting => (
                      <div 
                        key={meeting.id} 
                        className={`flex justify-between items-center border p-4 rounded-xl shadow-xs transition ${
                          meeting.status === 'suggested' 
                            ? 'border-dashed border-purple-500/30 bg-purple-500/[0.02]' 
                            : 'bg-crm-bg/40 border-crm-border'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${
                            meeting.status === 'completed' 
                              ? 'bg-primary/10 text-primary' 
                              : meeting.status === 'suggested'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                              : 'bg-crm-bg text-crm-muted border border-crm-border'
                          }`}>
                            {meeting.status === 'completed' ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                          </div>
                          <div>
                            <Link 
                              to={`/contacts/${meeting.contactId}`}
                              className="text-sm font-bold text-crm-text hover:text-primary transition"
                            >
                              {meeting.contactName}
                            </Link>
                            <p className="text-xs text-crm-muted font-medium">
                              {meeting.companyName} &bull; {new Date(meeting.scheduledAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div>
                          {meeting.status === 'completed' ? (
                            <span className="text-xs bg-primary/10 text-primary border border-primary/25 px-2.5 py-1 rounded-full font-bold capitalize">
                              {meeting.outcome || 'Completed'}
                            </span>
                          ) : meeting.status === 'suggested' ? (
                            <span className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-450 border border-purple-500/25 px-2.5 py-1 rounded-full font-bold">
                              AI Suggested
                            </span>
                          ) : (
                            <span className="text-xs bg-crm-bg text-crm-muted border border-crm-border px-2.5 py-1 rounded-full font-semibold">
                              Scheduled
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {myMeetingsThisMonth.length > 4 && (
                  <button 
                    onClick={() => navigate('/meetings')}
                    className="block w-full text-center text-xs text-primary hover:text-primary-hover font-bold py-2 hover:underline focus:outline-none"
                  >
                    View all +{myMeetingsThisMonth.length - (todayMeetings.length > 0 ? todayMeetings.length + 3 : 4)} meetings
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Value breakdown */}
        <div className="bg-crm-card border border-crm-border p-6 rounded-2xl flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-crm-text">Pipeline Stages</h3>
                <p className="text-xs text-crm-muted mt-0.5 font-medium">Summary of deal flow stages</p>
              </div>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>

            <div className="space-y-4">
              {[
                { label: 'Qualification', key: 'qualification' as const, color: 'bg-blue-500' },
                { label: 'Proposal', key: 'proposal' as const, color: 'bg-amber-500' },
                { label: 'Negotiation', key: 'negotiation' as const, color: 'bg-purple-500' },
                { label: 'Closed Won', key: 'closed-won' as const, color: 'bg-emerald-500' },
                { label: 'Closed Lost', key: 'closed-lost' as const, color: 'bg-rose-500' },
              ].map(stage => {
                const stat = stageStats[stage.key];
                return (
                  <div key={stage.key} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-crm-muted">
                      <span className="flex items-center font-bold text-xs">
                        <span className={`w-2 h-2 rounded-full ${stage.color} mr-2`} />
                        {stage.label} ({stat.count})
                      </span>
                      <span className="text-crm-text font-bold">${stat.value.toLocaleString()}</span>
                    </div>
                    {/* Visual mini bar */}
                    <div className="w-full h-1 bg-crm-bg rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${stage.color} rounded-full`} 
                        style={{ 
                          width: `${deals.length > 0 ? (stat.count / deals.length) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Link 
            to="/deals" 
            className="mt-6 flex justify-center items-center space-x-2 border border-crm-border hover:bg-crm-bg hover:text-crm-text text-crm-muted rounded-xl py-2.5 font-bold text-sm transition shadow-sm"
          >
            <span>Open Deals Board</span>
          </Link>
        </div>

      </div>
    </div>
  );
};
