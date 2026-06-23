import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDealStore } from '../stores/useDealStore';
import type { DealStage, Deal } from '../stores/useDealStore';
import { useCompanyStore } from '../stores/useCompanyStore';
import { useContactStore } from '../stores/useContactStore';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  Trash2, 
  Edit, 
  ChevronLeft, 
  ChevronRight, 
  DollarSign, 
  X, 
  AlertCircle 
} from 'lucide-react';

const STAGES: { key: DealStage; label: string; color: string }[] = [
  { key: 'qualification', label: 'Qualification', color: 'border-t-blue-500 bg-blue-500/[0.03]' },
  { key: 'proposal', label: 'Proposal', color: 'border-t-amber-500 bg-amber-500/[0.03]' },
  { key: 'negotiation', label: 'Negotiation', color: 'border-t-purple-500 bg-purple-500/[0.03]' },
  { key: 'closed-won', label: 'Closed Won', color: 'border-t-emerald-500 bg-emerald-500/[0.03]' },
  { key: 'closed-lost', label: 'Closed Lost', color: 'border-t-rose-500 bg-rose-500/[0.03]' },
];

export const Deals: React.FC = () => {
  const { user } = useAuth();
  const canManageDeals = user?.role === 'admin' || user?.permissions?.canManageDeals !== false;

  // Load stores
  const deals = useDealStore(state => state.deals);
  const dealsLoading = useDealStore(state => state.loading);
  const addDeal = useDealStore(state => state.addDeal);
  const updateDeal = useDealStore(state => state.updateDeal);
  const updateDealStage = useDealStore(state => state.updateDealStage);
  const deleteDeal = useDealStore(state => state.deleteDeal);

  const companies = useCompanyStore(state => state.companies);
  const contacts = useContactStore(state => state.contacts);

  const initCompanies = useCompanyStore(state => state.initialize);
  const initContacts = useContactStore(state => state.initialize);

  useEffect(() => {
    const unsubComp = initCompanies();
    const unsubCont = initContacts();
    return () => {
      unsubComp();
      unsubCont();
    };
  }, [initCompanies, initContacts]);

  // Modal form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [value, setValue] = useState<number>(0);
  const [stage, setStage] = useState<DealStage>('qualification');
  const [companyId, setCompanyId] = useState('');
  const [contactId, setContactId] = useState('');
  const [assignedSalespersonId, setAssignedSalespersonId] = useState('sales-uid');

  const [formError, setFormError] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setValue(0);
    setStage('qualification');
    setCompanyId(companies[0]?.id || '');
    setContactId(contacts[0]?.id || '');
    setAssignedSalespersonId(user?.uid || 'sales-uid');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (d: Deal) => {
    setEditingId(d.id);
    setName(d.name);
    setValue(d.value);
    setStage(d.stage);
    setCompanyId(d.companyId);
    setContactId(d.contactId);
    setAssignedSalespersonId(d.assignedSalespersonId || 'sales-uid');
    setFormError(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this deal?')) {
      try {
        await deleteDeal(id);
      } catch (err) {
        console.error('Failed to delete deal:', err);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Please enter a deal name.');
      return;
    }
    if (!companyId) {
      setFormError('Please choose a company association.');
      return;
    }
    if (!contactId) {
      setFormError('Please choose a primary contact.');
      return;
    }

    const selectedCompany = companies.find(c => c.id === companyId);
    const companyName = selectedCompany ? selectedCompany.name : 'Unknown';

    const selectedContact = contacts.find(c => c.id === contactId);
    const contactName = selectedContact ? selectedContact.name : 'Unknown';

    const dealData = {
      name,
      value: Number(value),
      stage,
      companyId,
      companyName,
      contactId,
      contactName,
      assignedSalespersonId,
    };

    try {
      if (editingId) {
        await updateDeal(editingId, dealData);
      } else {
        await addDeal(dealData);
      }
      setModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error saving deal.');
    }
  };

  // Helper to shift a deal card's stage
  const shiftStage = async (deal: Deal, direction: 'left' | 'right') => {
    const currentIndex = STAGES.findIndex(s => s.key === deal.stage);
    let newIndex = currentIndex;

    if (direction === 'left' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === 'right' && currentIndex < STAGES.length - 1) {
      newIndex = currentIndex + 1;
    }

    if (newIndex !== currentIndex) {
      try {
        await updateDealStage(deal.id, STAGES[newIndex].key);
      } catch (err) {
        console.error('Failed to update stage:', err);
      }
    }
  };

  // Group deals by stage
  const dealsByStage = (stageKey: DealStage) => {
    return deals.filter(d => d.stage === stageKey);
  };

  // Calculate column subtotal sums
  const getStageTotal = (stageKey: DealStage) => {
    return dealsByStage(stageKey).reduce((sum, d) => sum + d.value, 0);
  };

  return (
    <div className="space-y-6 h-full flex flex-col text-crm-text animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-crm-text">Deals Board</h1>
          <p className="text-crm-muted text-sm mt-0.5 font-medium">Track deal pipeline progress and stages</p>
        </div>
        {canManageDeals && (
          <button
            onClick={openAddModal}
            className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-primary/10"
          >
            <Plus className="h-4 w-4" />
            <span>New Deal</span>
          </button>
        )}
      </div>

      {/* Board Columns Grid */}
      {dealsLoading ? (
        <div className="text-center py-20">
          <div className="w-10 h-10 border-4 border-crm-border border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-crm-muted text-sm">Loading deal board...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex space-x-5 min-w-[1200px] h-full items-start">
            {STAGES.map((col) => {
              const stageDeals = dealsByStage(col.key);
              const totalVal = getStageTotal(col.key);

              return (
                <div 
                  key={col.key}
                  className="w-72 bg-crm-card border border-crm-border rounded-2xl flex flex-col max-h-[70vh] shadow-sm"
                >
                  {/* Column Header */}
                  <div className={`p-4 border-b border-crm-border border-t-4 ${col.color} rounded-t-2xl shrink-0`}>
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-sm text-crm-text">{col.label}</span>
                      <span className="text-xs bg-crm-bg text-crm-muted font-bold px-2 py-0.5 rounded-full border border-crm-border">
                        {stageDeals.length}
                      </span>
                    </div>
                    <p className="text-xs text-primary font-extrabold mt-2">
                      Total: ${totalVal.toLocaleString()}
                    </p>
                  </div>

                  {/* Column Cards Feed */}
                  <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-crm-bg/10">
                    {stageDeals.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-crm-border rounded-xl">
                        <p className="text-crm-muted text-xs italic font-medium">No deals in this stage</p>
                      </div>
                    ) : (
                      stageDeals.map((deal) => (
                        <div 
                          key={deal.id}
                          className="bg-crm-card border border-crm-border p-4 rounded-xl space-y-3 relative group hover:border-primary/35 hover:shadow transition"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-sm text-crm-text leading-tight group-hover:text-primary transition">
                                {deal.name}
                              </h4>
                              <p className="text-[10px] text-crm-muted mt-1 font-bold">
                                {deal.companyName} &bull; {deal.contactName}
                              </p>
                              <p className="text-[10px] text-primary/80 dark:text-primary-hover/90 mt-1 font-semibold flex items-center space-x-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
                                <span>Owner: {deal.assignedSalespersonId === 'admin-uid' ? 'Admin User' : 'John Salesperson'}</span>
                              </p>
                            </div>
                            {canManageDeals && (
                              <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                                <button
                                  onClick={() => openEditModal(deal)}
                                  className="p-1 text-crm-muted hover:text-primary hover:bg-crm-bg rounded border border-transparent hover:border-crm-border"
                                  title="Edit Deal"
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handleDelete(deal.id)}
                                  className="p-1 text-crm-muted hover:text-rose-500 hover:bg-crm-bg rounded border border-transparent hover:border-crm-border"
                                  title="Delete Deal"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-crm-border/60">
                            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                              ${deal.value.toLocaleString()}
                            </span>
                            
                            {/* Card stage chevrons */}
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => shiftStage(deal, 'left')}
                                className="p-1 bg-crm-bg hover:bg-crm-border text-crm-muted hover:text-crm-text border border-crm-border hover:border-crm-muted rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition"
                                disabled={!canManageDeals || col.key === 'qualification'}
                                title="Move Left"
                              >
                                <ChevronLeft className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => shiftStage(deal, 'right')}
                                className="p-1 bg-crm-bg hover:bg-crm-border text-crm-muted hover:text-crm-text border border-crm-border hover:border-crm-muted rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition"
                                disabled={!canManageDeals || col.key === 'closed-lost' || col.key === 'closed-won'}
                                title="Move Right"
                              >
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Deal Modal */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="w-full max-w-4xl bg-crm-card border border-crm-border rounded-3xl p-6 shadow-2xl relative text-crm-text animate-fade-in">
            <button 
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-crm-text mb-2">
              {editingId ? 'Edit Deal' : 'Add New Deal'}
            </h3>
            <p className="text-xs text-crm-muted mb-6">Enter deal pipeline details</p>

            {formError && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* Left Column: Deal Identity */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Deal Details</h4>
                  <div>
                    <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Deal Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. 100 Cybertrucks Fleet"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted outline-none transition"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Deal Value ($) *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-crm-muted">
                          <DollarSign className="h-4 w-4" />
                        </div>
                        <input
                          type="number"
                          placeholder="0"
                          value={value === 0 ? '' : value}
                          onChange={(e) => setValue(Number(e.target.value))}
                          className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl pl-9 pr-4 py-2.5 text-sm text-crm-text placeholder-crm-muted outline-none transition"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Pipeline Stage</label>
                      <select
                        value={stage}
                        onChange={(e) => setStage(e.target.value as DealStage)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                      >
                        {STAGES.map(s => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Right Column: Account & Stakeholders */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Associations & Owner</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Company Association *</label>
                      <select
                        value={companyId}
                        onChange={(e) => setCompanyId(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                        required
                      >
                        <option value="" disabled>Select Company</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Primary Contact *</label>
                      <select
                        value={contactId}
                        onChange={(e) => setContactId(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                        required
                      >
                        <option value="" disabled>Select Contact</option>
                        {contacts.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Assigned Salesperson *</label>
                    <select
                      value={assignedSalespersonId}
                      onChange={(e) => setAssignedSalespersonId(e.target.value)}
                      className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                      required
                    >
                      <option value="sales-uid">John Salesperson</option>
                      <option value="admin-uid">Admin User</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6 border-t border-crm-border/60 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-sm border border-crm-border transition shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-primary/10"
                >
                  {editingId ? 'Save Changes' : 'Create Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
