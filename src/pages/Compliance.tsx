import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMeetingStore } from '../stores/useMeetingStore';
import type { Meeting } from '../stores/useMeetingStore';
import { useDealStore } from '../stores/useDealStore';
import { useUserStore } from '../stores/useUserStore';
import { 
  Shield, 
  Calendar, 
  Download, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Briefcase,
  Filter,
  Building2
} from 'lucide-react';

const isMeetingOverdue = (meeting: Meeting, now: number) => {
  if (meeting.status === 'completed') return false;
  const scheduledTime = new Date(meeting.scheduledAt).getTime();
  const endTime = scheduledTime + 60 * 60 * 1000; // 1 hour duration
  return now > endTime;
};

export const Compliance: React.FC = () => {
  const { user } = useAuth();
  const [now] = useState(() => Date.now());
  
  // Load stores
  const meetings = useMeetingStore(state => state.meetings);
  const deals = useDealStore(state => state.deals);
  const users = useUserStore(state => state.users);

  const initMeetings = useMeetingStore(state => state.initialize);
  const initDeals = useDealStore(state => state.initialize);
  const initUsers = useUserStore(state => state.initialize);

  useEffect(() => {
    const unsubMeetings = initMeetings();
    const unsubDeals = initDeals();
    const unsubUsers = initUsers();

    return () => {
      unsubMeetings();
      unsubDeals();
      unsubUsers();
    };
  }, [initMeetings, initDeals, initUsers]);

  // Current Month calculations
  const d = new Date();
  const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  // State
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string>('all');
  const [hoveredCell, setHoveredCell] = useState<{ repId: string; day: number; meetings: Meeting[] } | null>(null);

  // Role check and selection locking
  const isSalesperson = user?.role === 'salesperson';
  const currentUserId = user?.uid || '';

  const resolvedSalespersonId = isSalesperson ? currentUserId : selectedSalespersonId;

  // Fetch unique list of salespeople present in database
  const allSalespeople = React.useMemo(() => {
    // Collect from users store
    const list = [...users];
    
    // Add default mock users if not present in store
    if (!list.some(u => u.uid === 'admin-uid')) {
      list.push({ uid: 'admin-uid', email: 'admin@northstar.com', displayName: 'Admin User', role: 'admin' });
    }
    if (!list.some(u => u.uid === 'sales-uid')) {
      list.push({ uid: 'sales-uid', email: 'sales@northstar.com', displayName: 'John Salesperson', role: 'salesperson' });
    }

    // Filter to only those with salesperson or admin roles who have logged meetings or exist in profile database
    return list.filter(u => u.role === 'salesperson' || u.role === 'admin');
  }, [users]);

  // 6 months list helper for historical drill-down
  const pastMonths = React.useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const temp = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}`;
      const readable = temp.toLocaleString('default', { month: 'short', year: 'numeric' });
      list.push({ monthStr, readable });
    }
    return list;
  }, []);

  // isMeetingOverdue helper is defined at module scope

  // Helper: check if meeting scheduledAt is on a specific day of the selected month
  const isMeetingOnDay = (meeting: Meeting, day: number, monthStr: string) => {
    if (meeting.month !== monthStr) return false;
    const date = new Date(meeting.scheduledAt);
    return date.getDate() === day;
  };

  // Days in selected month
  const daysInMonth = React.useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  }, [selectedMonth]);

  // Filter meetings based on active selections
  const filteredMeetingsForMonth = React.useMemo(() => {
    return meetings.filter(m => {
      const matchMonth = m.month === selectedMonth;
      const matchRep = resolvedSalespersonId === 'all' ? true : m.salespersonId === resolvedSalespersonId;
      return matchMonth && matchRep;
    });
  }, [meetings, selectedMonth, resolvedSalespersonId]);

  // KPI Calculations
  const kpis = React.useMemo(() => {
    // 1. Visit Completion Rate: Completed / (Completed + Pending + Overdue)
    const completedList = filteredMeetingsForMonth.filter(m => m.status === 'completed');
    const completedCount = completedList.length;
    const pendingCount = filteredMeetingsForMonth.filter(m => m.status === 'pending' && !isMeetingOverdue(m, now)).length;
    const overdueCount = filteredMeetingsForMonth.filter(m => isMeetingOverdue(m, now)).length;
    const totalScheduled = completedCount + pendingCount + overdueCount;

    const completionRate = totalScheduled > 0 ? Math.round((completedCount / totalScheduled) * 100) : 0;

    // 2. Active Accounts Visited: Count of unique companies/contacts met
    const uniqueAccounts = new Set(
      completedList.map(m => m.companyId || m.companyName || m.contactId)
    );
    const activeAccountsCount = uniqueAccounts.size;

    // 3. Pipeline Value (aggregated open deals from Deals Board)
    const openDeals = deals.filter(d => d.stage !== 'closed-won' && d.stage !== 'closed-lost');
    const filteredDeals = resolvedSalespersonId === 'all'
      ? openDeals
      : openDeals.filter(d => d.assignedSalespersonId === resolvedSalespersonId);
    const pipelineValue = filteredDeals.reduce((sum, d) => sum + d.value, 0);

    return {
      completionRate,
      activeAccountsCount,
      pipelineValue,
      completedCount,
      pendingCount,
      overdueCount,
      totalScheduled
    };
  }, [filteredMeetingsForMonth, deals, resolvedSalespersonId, now]);

  // Heatmap rows helper based on filters
  const heatmapReps = React.useMemo(() => {
    if (resolvedSalespersonId !== 'all') {
      const rep = allSalespeople.find(u => u.uid === resolvedSalespersonId);
      return rep ? [rep] : [];
    }
    return allSalespeople;
  }, [allSalespeople, resolvedSalespersonId]);

  // Export to CSV helper
  const handleExportCSV = () => {
    const headers = ['Date', 'Time', 'Salesperson', 'Contact', 'Company', 'Status', 'Outcome', 'Completed At', 'Comments'];
    const rows = filteredMeetingsForMonth.map(m => {
      let statusLabel = 'Scheduled';
      if (m.status === 'completed') statusLabel = 'Completed';
      else if (isMeetingOverdue(m, now)) statusLabel = 'Overdue';
      
      const rep = allSalespeople.find(u => u.uid === m.salespersonId);
      const repName = rep ? rep.displayName : m.salespersonId;

      return [
        new Date(m.scheduledAt).toLocaleDateString(),
        new Date(m.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        repName,
        m.contactName,
        m.companyName,
        statusLabel,
        m.outcome || 'N/A',
        m.completedAt ? new Date(m.completedAt).toLocaleString() : 'N/A',
        (m.comments || '').replace(/"/g, '""').replace(/\n/g, ' ')
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `compliance_report_${selectedMonth}_${resolvedSalespersonId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fade-in text-crm-text">
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-crm-card border border-crm-border p-6 rounded-3xl relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-crm-text flex items-center space-x-3">
            <Shield className="h-7 w-7 text-primary" />
            <span>Compliance Dashboard</span>
          </h1>
          <p className="text-crm-muted text-sm mt-1 font-medium">
            Monitor visit compliance, log outcomes, and analyze team touchpoint coverage.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Salesperson Filter */}
          <div className="flex items-center space-x-2 bg-crm-bg border border-crm-border px-3 py-1.5 rounded-xl text-xs font-semibold shadow-inner">
            <Filter className="h-3.5 w-3.5 text-primary" />
            <select
              value={resolvedSalespersonId}
              onChange={(e) => setSelectedSalespersonId(e.target.value)}
              disabled={isSalesperson}
              className="bg-transparent border-none text-crm-text outline-none cursor-pointer font-bold disabled:opacity-80"
            >
              {!isSalesperson && <option value="all">All Salespeople</option>}
              {allSalespeople.map(rep => (
                <option key={rep.uid} value={rep.uid}>{rep.displayName}</option>
              ))}
            </select>
          </div>

          {/* Download CSV button (Visible to Manager/Admin) */}
          {!isSalesperson && (
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl font-bold text-xs transition shadow-lg shadow-primary/10 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Download Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Monthly historical drill-down selector */}
      <div className="flex items-center space-x-2.5 overflow-x-auto pb-2 scrollbar-thin">
        {pastMonths.map(m => {
          const isActive = selectedMonth === m.monthStr;
          return (
            <button
              key={m.monthStr}
              onClick={() => setSelectedMonth(m.monthStr)}
              className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition border whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-primary border-primary text-white shadow-md'
                  : 'bg-crm-card border-crm-border hover:border-crm-muted/50 text-crm-muted hover:text-crm-text'
              }`}
            >
              <Calendar className="inline-block h-3.5 w-3.5 mr-1.5 -mt-0.5" />
              {m.readable}
            </button>
          );
        })}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* KPI 1: Visit Completion Rate */}
        <div className="bg-crm-card border border-crm-border p-5 rounded-2xl flex flex-col justify-between hover:border-primary/30 transition shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-crm-muted uppercase tracking-wider">Visit Completion Rate</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <p className="text-3xl font-extrabold text-crm-text">{kpis.completionRate}%</p>
              <span className="text-xs font-semibold text-crm-muted">({kpis.completedCount} of {kpis.totalScheduled} met)</span>
            </div>
            {/* Mini Progress bar */}
            <div className="w-full h-1.5 bg-crm-bg rounded-full overflow-hidden mt-3 border border-crm-border/40">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                style={{ width: `${kpis.completionRate}%` }}
              />
            </div>
            <p className="text-[10px] text-crm-muted mt-2 font-medium">Scheduled visits completed</p>
          </div>
        </div>

        {/* KPI 2: Total Sales Pipeline Value */}
        <div className="bg-crm-card border border-crm-border p-5 rounded-2xl flex flex-col justify-between hover:border-primary/30 transition shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-crm-muted uppercase tracking-wider">Sales Pipeline Value</span>
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-crm-text">${kpis.pipelineValue.toLocaleString()}</p>
            <p className="text-xs text-crm-muted mt-1.5 font-medium">
              {resolvedSalespersonId === 'all' ? 'CRM pipeline value total' : 'Rep pipeline value'}
            </p>
          </div>
        </div>

        {/* KPI 3: Active Accounts Visited */}
        <div className="bg-crm-card border border-crm-border p-5 rounded-2xl flex flex-col justify-between hover:border-primary/30 transition shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-crm-muted uppercase tracking-wider">Active Accounts</span>
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-crm-text">{kpis.activeAccountsCount}</p>
            <p className="text-xs text-crm-muted mt-1.5 font-medium">Unique companies/contacts visited</p>
          </div>
        </div>
      </div>

      {/* Visual Activity Heatmap Card */}
      <div className="bg-crm-card border border-crm-border p-6 rounded-2xl shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-crm-text">Sales Representative Activity Matrix</h3>
            <p className="text-xs text-crm-muted mt-0.5 font-medium">Daily compliance status heatmap for {selectedMonth}</p>
          </div>
          
          {/* Heatmap Legend */}
          <div className="flex items-center space-x-3.5 text-[10px] font-bold text-crm-muted">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 border border-emerald-600/30" />
              <span>Completed</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 border border-amber-500/30 animate-pulse" />
              <span>Scheduled</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 border border-rose-600/30" />
              <span>Overdue</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-crm-bg border border-crm-border" />
              <span>No Activity</span>
            </div>
          </div>
        </div>

        {/* Heatmap Render */}
        <div className="overflow-x-auto pb-4 scrollbar-thin">
          <div className="min-w-[900px] space-y-4">
            {heatmapReps.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-crm-border rounded-xl">
                <p className="text-crm-muted text-sm font-semibold">No representatives matching current filter.</p>
              </div>
            ) : (
              heatmapReps.map(rep => {
                // Find all meetings for this rep in this month
                const repMeetings = meetings.filter(m => m.salespersonId === rep.uid && m.month === selectedMonth);

                return (
                  <div key={rep.uid} className="flex items-center space-x-4">
                    {/* Rep identity name label */}
                    <div className="w-48 truncate flex items-center space-x-2">
                      <div className="h-6.5 w-6.5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] text-primary font-bold shadow-inner">
                        {rep.displayName.slice(0,2).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-crm-text">{rep.displayName}</span>
                    </div>

                    {/* Heatmap Days Grid */}
                    <div className="flex-1 flex items-center gap-1.5">
                      {Array.from({ length: daysInMonth }, (_, index) => {
                        const day = index + 1;
                        
                        // Find meetings on this day
                        const dayMeetings = repMeetings.filter(m => isMeetingOnDay(m, day, selectedMonth));
                        
                        // Determine Cell status color coding
                        let colorClass = 'bg-crm-bg border-crm-border hover:border-crm-muted/50';

                        if (dayMeetings.length > 0) {
                          if (dayMeetings.some(m => isMeetingOverdue(m, now))) {
                            colorClass = 'bg-rose-500 border-rose-600/30 text-white';
                          } else if (dayMeetings.some(m => m.status === 'completed')) {
                            colorClass = 'bg-emerald-500 border-emerald-600/30 text-white';
                          } else if (dayMeetings.some(m => m.status === 'pending' || m.status === 'suggested')) {
                            colorClass = 'bg-amber-400 border-amber-500/30 text-slate-900';
                          }
                        }

                        return (
                          <div
                            key={day}
                            onMouseEnter={() => dayMeetings.length > 0 && setHoveredCell({ repId: rep.uid, day, meetings: dayMeetings })}
                            onMouseLeave={() => setHoveredCell(null)}
                            className={`w-7 h-7 rounded-lg border text-[10px] font-bold flex items-center justify-center transition-all duration-150 relative cursor-pointer select-none ${colorClass}`}
                          >
                            <span>{day}</span>

                            {/* Tiny dot if multiple meetings */}
                            {dayMeetings.length > 1 && (
                              <span className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-white/70" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Hover Tooltip/Detail box */}
        <div className="mt-4 min-h-[50px] transition-all">
          {hoveredCell ? (
            <div className="bg-crm-bg border border-crm-border p-3.5 rounded-xl text-xs space-y-2 animate-fade-in shadow-inner">
              <p className="font-bold text-primary flex items-center space-x-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Day {hoveredCell.day} - {hoveredCell.meetings.length} Scheduled Activity Entry / Entries
                </span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {hoveredCell.meetings.map(m => {
                  let badgeColor = 'bg-amber-500/15 border-amber-500/25 text-amber-500';
                  let statusText = 'Scheduled';
                  if (m.status === 'completed') {
                    badgeColor = 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500';
                    statusText = 'Completed';
                  } else if (isMeetingOverdue(m, now)) {
                    badgeColor = 'bg-rose-500/15 border-rose-500/25 text-rose-500';
                    statusText = 'Overdue';
                  }

                  return (
                    <div key={m.id} className="border border-crm-border/60 bg-crm-card/50 p-2.5 rounded-lg flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-baseline mb-1">
                          <strong className="text-crm-text">{m.contactName}</strong>
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${badgeColor}`}>
                            {statusText}
                          </span>
                        </div>
                        <p className="text-[10px] text-crm-muted font-medium">{m.companyName}</p>
                      </div>
                      
                      {m.status === 'completed' && m.outcome && (
                        <p className="text-[10px] text-primary font-bold mt-1.5">
                          Outcome: {m.outcome}
                        </p>
                      )}
                      
                      {isMeetingOverdue(m, now) && (
                        <p className="text-[10px] text-rose-500 font-bold mt-1.5 flex items-center space-x-1">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span>System Flag: Overdue Visit Report</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-crm-muted italic text-center py-2.5 font-medium border border-dashed border-crm-border/70 rounded-xl bg-crm-bg/15">
              Hover over colored day square grid columns above to inspect daily touchpoint meeting notes and reports.
            </p>
          )}
        </div>
      </div>

      {/* Compliance list view table */}
      <div className="bg-crm-card border border-crm-border rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-crm-text">Compliance Audit Logs</h3>
            <p className="text-xs text-crm-muted mt-0.5 font-medium">Activity reports and logs matching filter selections</p>
          </div>
          <span className="text-xs font-bold bg-crm-bg px-3 py-1 rounded-full border border-crm-border text-primary shadow-inner">
            {filteredMeetingsForMonth.length} Records Found
          </span>
        </div>

        {filteredMeetingsForMonth.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-crm-border rounded-xl">
            <Calendar className="h-10 w-10 text-crm-muted mx-auto mb-3" />
            <p className="text-crm-text text-sm font-bold">No compliance logs matching selection</p>
            <p className="text-crm-muted text-xs mt-1">Try selecting a different month or salesperson.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-crm-border text-crm-muted font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">Date/Time</th>
                  <th className="py-3 px-4">Salesperson</th>
                  <th className="py-3 px-4">Account/Contact</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">System Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crm-border/60">
                {filteredMeetingsForMonth.map(m => {
                  let statusBadge = 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
                  let statusText = 'Scheduled';
                  if (m.status === 'completed') {
                    statusBadge = 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
                    statusText = 'Completed';
                  } else if (isMeetingOverdue(m, now)) {
                    statusBadge = 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
                    statusText = 'Overdue';
                  }

                  const rep = allSalespeople.find(u => u.uid === m.salespersonId);
                  const repName = rep ? rep.displayName : m.salespersonId;

                  return (
                    <tr key={m.id} className="hover:bg-crm-bg/25 transition">
                      <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                        {new Date(m.scheduledAt).toLocaleDateString()} &bull; {new Date(m.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-crm-text">
                        {repName}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-crm-text">{m.contactName}</div>
                        <div className="text-[10px] text-crm-muted font-medium">{m.companyName}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${statusBadge}`}>
                          {statusText}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {m.status === 'completed' ? (
                          <span className="font-bold text-primary">{m.outcome || 'Logged Visit'}</span>
                        ) : isMeetingOverdue(m, now) ? (
                          <span className="text-rose-500 font-bold flex items-center space-x-1 text-[10px]">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>Overdue Report</span>
                          </span>
                        ) : (
                          <span className="text-crm-muted">Awaiting Visit</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-crm-muted whitespace-nowrap font-medium">
                        {m.completedAt ? (
                          <span title="Timestamped automatically on save">
                            🕒 {new Date(m.completedAt).toLocaleString()}
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
