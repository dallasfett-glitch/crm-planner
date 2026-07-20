import React, { useState, useEffect, useRef } from 'react';
import { useMeetingStore, DEFAULT_CADENCES } from '../stores/useMeetingStore';
import { useAuth } from '../context/AuthContext';
import { 
  Sliders, 
  AlertCircle, 
  Save, 
  CheckCircle, 
  Image, 
  Upload, 
  RotateCcw,
  Palette,
  ClipboardList,
  Trash2,
  Edit3,
  X
} from 'lucide-react';

interface CustomOutcome {
  id: string;
  label: string;
  workflow: 'none' | 'follow-up' | 'not-interested';
}
import { useNavigate } from 'react-router-dom';

const CADENCE_KEY = 'crm_cadence_settings';

const generateOutcomeId = (): string => `outcome-${Date.now()}`;

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const runPredictiveSuggestions = useMeetingStore(state => state.runPredictiveSuggestions);
  const meetings = useMeetingStore(state => state.meetings);
  const updateHistoricalOutcomes = useMeetingStore(state => state.updateHistoricalOutcomes);
  const initMeetings = useMeetingStore(state => state.initialize);

  // Cadence states
  const [cadenceA, setCadenceA] = useState<number>(() => {
    const stored = localStorage.getItem(CADENCE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).A || DEFAULT_CADENCES.A;
      } catch {
        return DEFAULT_CADENCES.A;
      }
    }
    return DEFAULT_CADENCES.A;
  });
  const [cadenceB, setCadenceB] = useState<number>(() => {
    const stored = localStorage.getItem(CADENCE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).B || DEFAULT_CADENCES.B;
      } catch {
        return DEFAULT_CADENCES.B;
      }
    }
    return DEFAULT_CADENCES.B;
  });
  const [cadenceC, setCadenceC] = useState<number>(() => {
    const stored = localStorage.getItem(CADENCE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored).C || DEFAULT_CADENCES.C;
      } catch {
        return DEFAULT_CADENCES.C;
      }
    }
    return DEFAULT_CADENCES.C;
  });

  // Logo states (Base64 data URLs)
  const [logoLight, setLogoLight] = useState<string | null>(() => localStorage.getItem('crm_logo_light'));
  const [logoDark, setLogoDark] = useState<string | null>(() => localStorage.getItem('crm_logo_dark'));
  const [logoIcon, setLogoIcon] = useState<string | null>(() => localStorage.getItem('CRM Planner_logo_icon'));

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customizable outcomes states
  const [outcomes, setOutcomes] = useState<CustomOutcome[]>(() => {
    const storedOutcomes = localStorage.getItem('crm_meeting_outcomes');
    if (storedOutcomes) {
      try {
        return JSON.parse(storedOutcomes);
      } catch (err) {
        console.error('Failed to parse meeting outcomes:', err);
      }
    }
    const defaults: CustomOutcome[] = [
      { id: 'ordered', label: 'Successfully Ordered / Reordered', workflow: 'none' },
      { id: 'sample', label: 'Sample Sent (Waiting for feedback)', workflow: 'none' },
      { id: 'follow-up', label: 'Follow-up Required', workflow: 'follow-up' },
      { id: 'not-interested', label: 'Not Interested', workflow: 'not-interested' }
    ];
    localStorage.setItem('crm_meeting_outcomes', JSON.stringify(defaults));
    return defaults;
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [outcomeLabel, setOutcomeLabel] = useState('');
  const [outcomeWorkflow, setOutcomeWorkflow] = useState<'none' | 'follow-up' | 'not-interested'>('none');
  const [outcomesSuccess, setOutcomesSuccess] = useState<string | null>(null);
  const [outcomesError, setOutcomesError] = useState<string | null>(null);

  // States for confirmation dialog
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    oldLabel: string;
    newLabel: string;
    affectedCount: number;
    action: () => void;
  } | null>(null);

  const fileInputLight = useRef<HTMLInputElement>(null);
  const fileInputDark = useRef<HTMLInputElement>(null);
  const fileInputIcon = useRef<HTMLInputElement>(null);

  // Redirect unauthorized users
  useEffect(() => {
    const canManageSettings = user?.role === 'admin' || user?.permissions?.canManageCadences === true;
    if (user && !canManageSettings) {
      navigate('/');
    }
  }, [user, navigate]);

  // Initialize meetings store to ensure state is synchronized and isOutcomeInUse checks are reactive
  useEffect(() => {
    const unsubMeetings = initMeetings();
    return () => {
      unsubMeetings();
    };
  }, [initMeetings]);

  // Save Cadences Form
  const handleSaveCadence = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedSuccess(false);

    if (cadenceA <= 0 || cadenceB <= 0 || cadenceC <= 0) {
      setError('Cadence days must be positive integers.');
      return;
    }

    const settings = {
      A: Number(cadenceA),
      B: Number(cadenceB),
      C: Number(cadenceC)
    };

    try {
      localStorage.setItem(CADENCE_KEY, JSON.stringify(settings));
      setSavedSuccess(true);
      
      // Trigger core suggestions engine refresh with the new configurations
      runPredictiveSuggestions();
      
      setTimeout(() => {
        setSavedSuccess(false);
      }, 3000);
    } catch {
      setError('Failed to save configuration settings.');
    }
  };

  // Helper: File to Base64
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, format: 'light' | 'dark' | 'icon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Invalid file format. Please select an image file (PNG, JPG, SVG, etc.).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds the 2MB limit. Please upload a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (format === 'light') {
        localStorage.setItem('crm_logo_light', base64);
        setLogoLight(base64);
      } else if (format === 'dark') {
        localStorage.setItem('crm_logo_dark', base64);
        setLogoDark(base64);
      } else if (format === 'icon') {
        localStorage.setItem('CRM Planner_logo_icon', base64);
        setLogoIcon(base64);
      }
      // Dispatch reactive update event
      window.dispatchEvent(new CustomEvent('crm-logo-updated'));
    };
    reader.onerror = () => {
      alert('Error reading image file.');
    };
    reader.readAsDataURL(file);
  };

  // Helper: Reset Logo to Default
  const handleResetLogo = (format: 'light' | 'dark' | 'icon') => {
    if (format === 'light') {
      localStorage.removeItem('crm_logo_light');
      setLogoLight(null);
    } else if (format === 'dark') {
      localStorage.removeItem('crm_logo_dark');
      setLogoDark(null);
    } else if (format === 'icon') {
      localStorage.removeItem('CRM Planner_logo_icon');
      setLogoIcon(null);
    }
    // Dispatch reactive update event
    window.dispatchEvent(new CustomEvent('crm-logo-updated'));
  };

  // Customizable outcomes handlers
  const isOutcomeInUse = (label: string) => {
    return meetings.some(m => m.status === 'completed' && m.outcome === label);
  };

  const getAffectedMeetingsCount = (label: string) => {
    return meetings.filter(m => m.outcome === label).length;
  };

  const handleSaveOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    setOutcomesError(null);
    setOutcomesSuccess(null);

    const trimmedLabel = outcomeLabel.trim();
    if (!trimmedLabel) {
      setOutcomesError('Outcome display label is required.');
      return;
    }

    const exists = outcomes.some(
      o => o.label.toLowerCase() === trimmedLabel.toLowerCase() && o.id !== editingId
    );
    if (exists) {
      setOutcomesError('An outcome with this label already exists.');
      return;
    }

    if (editingId) {
      const originalOutcome = outcomes.find(o => o.id === editingId);
      if (!originalOutcome) return;

      const labelChanged = originalOutcome.label !== trimmedLabel;
      const affectedCount = labelChanged ? getAffectedMeetingsCount(originalOutcome.label) : 0;

      const proceedWithSave = async () => {
        if (labelChanged && affectedCount > 0) {
          await updateHistoricalOutcomes(originalOutcome.label, trimmedLabel);
        }

        const updated = outcomes.map(o => {
          if (o.id === editingId) {
            return { ...o, label: trimmedLabel, workflow: outcomeWorkflow };
          }
          return o;
        });

        localStorage.setItem('crm_meeting_outcomes', JSON.stringify(updated));
        setOutcomes(updated);
        window.dispatchEvent(new CustomEvent('crm-outcomes-updated'));
        setOutcomesSuccess(`Outcome "${trimmedLabel}" updated successfully!`);
        resetOutcomeForm();
      };

      if (labelChanged && affectedCount > 0) {
        setConfirmModalData({
          oldLabel: originalOutcome.label,
          newLabel: trimmedLabel,
          affectedCount,
          action: () => {
            proceedWithSave();
            setConfirmModalOpen(false);
          }
        });
        setConfirmModalOpen(true);
      } else {
        await proceedWithSave();
      }

    } else {
      const newOutcome: CustomOutcome = {
        id: generateOutcomeId(),
        label: trimmedLabel,
        workflow: outcomeWorkflow
      };

      const updated = [...outcomes, newOutcome];
      localStorage.setItem('crm_meeting_outcomes', JSON.stringify(updated));
      setOutcomes(updated);
      window.dispatchEvent(new CustomEvent('crm-outcomes-updated'));
      setOutcomesSuccess(`Outcome "${trimmedLabel}" added successfully!`);
      resetOutcomeForm();
    }
  };

  const handleDeleteOutcome = (id: string) => {
    setOutcomesError(null);
    setOutcomesSuccess(null);

    const outcomeToDelete = outcomes.find(o => o.id === id);
    if (!outcomeToDelete) return;

    if (isOutcomeInUse(outcomeToDelete.label)) {
      setOutcomesError(`Cannot delete outcome "${outcomeToDelete.label}" because it is currently in use in completed meeting logs.`);
      return;
    }

    if (confirm(`Are you sure you want to delete outcome "${outcomeToDelete.label}"?`)) {
      const updated = outcomes.filter(o => o.id !== id);
      localStorage.setItem('crm_meeting_outcomes', JSON.stringify(updated));
      setOutcomes(updated);
      window.dispatchEvent(new CustomEvent('crm-outcomes-updated'));
      setOutcomesSuccess(`Outcome "${outcomeToDelete.label}" deleted successfully.`);
      if (editingId === id) {
        resetOutcomeForm();
      }
    }
  };

  const startEditOutcome = (outcome: CustomOutcome) => {
    setEditingId(outcome.id);
    setOutcomeLabel(outcome.label);
    setOutcomeWorkflow(outcome.workflow);
    setOutcomesError(null);
    setOutcomesSuccess(null);
  };

  const resetOutcomeForm = () => {
    setEditingId(null);
    setOutcomeLabel('');
    setOutcomeWorkflow('none');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in text-crm-text">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-crm-text flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Palette className="h-7 w-7" />
          </div>
          <span>System Settings</span>
        </h1>
        <p className="text-crm-muted text-sm mt-1">Configure global cadence rules and upload custom brand logos for light & dark themes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Brand Customization */}
        <div className="space-y-6">
          <div className="bg-crm-card border border-crm-border rounded-2xl p-6 shadow-md space-y-6">
            <div className="flex items-center space-x-2 border-b border-crm-border/60 pb-3">
              <Image className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-crm-muted">Custom Brand Logo Uploads</h3>
            </div>

            <p className="text-xs text-crm-muted leading-relaxed">
              Upload custom brand graphics. Base64 encoding will save changes locally and update the navigation bar and authentication screens in real-time.
            </p>

            {/* Logo Format 1: Light Mode Brand Logo */}
            <div className="space-y-3.5 border-b border-crm-border/40 pb-5">
              <div className="flex justify-between items-baseline">
                <h4 className="text-xs font-bold text-crm-text uppercase">1. Light Mode Brand Logo</h4>
                {logoLight && (
                  <button 
                    onClick={() => handleResetLogo('light')}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center space-x-1 cursor-pointer bg-transparent border-none outline-none"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to Default</span>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-crm-muted">Shown in sidebar and login forms during Light mode theme (horizontal layout).</p>
              
              <div className="flex items-center space-x-4">
                <div className="h-20 w-44 rounded-xl border border-crm-border bg-white flex items-center justify-center p-2.5 overflow-hidden shadow-inner relative group">
                  {logoLight ? (
                    <img src={logoLight} alt="Light logo preview" className="h-full w-full object-contain" />
                  ) : (
                    <div className="text-center">
                      <img src="/logo.png" alt="Default light logo" className="h-9 w-auto object-contain" />
                      <span className="absolute bottom-1 left-0 right-0 text-[8px] font-bold text-slate-400 bg-slate-100/75 py-0.5">Default App Logo</span>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <button
                    onClick={() => fileInputLight.current?.click()}
                    className="flex items-center justify-center space-x-2 bg-crm-bg hover:bg-crm-border text-crm-text border border-crm-border px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer w-full"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload Image</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputLight}
                    onChange={(e) => handleLogoUpload(e, 'light')}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Logo Format 2: Dark Mode Brand Logo */}
            <div className="space-y-3.5 border-b border-crm-border/40 pb-5">
              <div className="flex justify-between items-baseline">
                <h4 className="text-xs font-bold text-crm-text uppercase">2. Dark Mode Brand Logo</h4>
                {logoDark && (
                  <button 
                    onClick={() => handleResetLogo('dark')}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center space-x-1 cursor-pointer bg-transparent border-none outline-none"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to Default</span>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-crm-muted">Shown in sidebar and login forms during Dark mode theme (horizontal layout).</p>

              <div className="flex items-center space-x-4">
                <div className="h-20 w-44 rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-center p-2.5 overflow-hidden shadow-inner relative group">
                  {logoDark ? (
                    <img src={logoDark} alt="Dark logo preview" className="h-full w-full object-contain" />
                  ) : (
                    <div className="text-center">
                      <img src="/logo.png" alt="Default dark logo" className="h-9 w-auto object-contain invert" />
                      <span className="absolute bottom-1 left-0 right-0 text-[8px] font-bold text-slate-600 bg-slate-950/75 py-0.5">Default App Logo</span>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <button
                    onClick={() => fileInputDark.current?.click()}
                    className="flex items-center justify-center space-x-2 bg-crm-bg hover:bg-crm-border text-crm-text border border-crm-border px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer w-full"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload Image</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputDark}
                    onChange={(e) => handleLogoUpload(e, 'dark')}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Logo Format 3: Square App Icon */}
            <div className="space-y-3.5 pb-2">
              <div className="flex justify-between items-baseline">
                <h4 className="text-xs font-bold text-crm-text uppercase">3. Square App Icon Logo</h4>
                {logoIcon && (
                  <button 
                    onClick={() => handleResetLogo('icon')}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center space-x-1 cursor-pointer bg-transparent border-none outline-none"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to Default</span>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-crm-muted">Shown in small mobile headers and avatar mockups (1:1 aspect ratio).</p>

              <div className="flex items-center space-x-4">
                <div className="h-20 w-20 rounded-xl border border-crm-border bg-crm-bg flex items-center justify-center p-2.5 overflow-hidden shadow-inner relative group">
                  {logoIcon ? (
                    <img src={logoIcon} alt="Icon logo preview" className="h-full w-full object-contain" />
                  ) : (
                    <div className="text-center font-extrabold text-sm text-primary bg-primary/10 border border-primary/20 p-2.5 rounded-xl">
                      NS
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <button
                    onClick={() => fileInputIcon.current?.click()}
                    className="flex items-center justify-center space-x-2 bg-crm-bg hover:bg-crm-border text-crm-text border border-crm-border px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer w-full"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload Icon</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputIcon}
                    onChange={(e) => handleLogoUpload(e, 'icon')}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Predictive Cadence Configurations */}
        <div className="space-y-6">
          <div className="bg-crm-card border border-crm-border rounded-2xl p-6 shadow-md space-y-6">
            <div className="flex items-center space-x-2 border-b border-crm-border/60 pb-3">
              <Sliders className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-crm-muted">Cadence Configuration</h3>
            </div>

            {error && (
              <div className="px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {savedSuccess && (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>Global cadence rules updated successfully! Suggested schedules re-seeded.</span>
              </div>
            )}

            <form onSubmit={handleSaveCadence} className="space-y-6">
              <div className="space-y-4">
                
                {/* Tier A */}
                <div className="grid grid-cols-3 gap-4 items-center border-b border-crm-border/60 pb-4">
                  <div className="col-span-2">
                    <h4 className="font-semibold text-sm text-crm-text">Tier A (Enterprise Clients)</h4>
                    <p className="text-xs text-crm-muted">High-priority enterprise customers. Suggested meet interval.</p>
                  </div>
                  <div>
                    <div className="relative">
                      <input
                        type="number"
                        value={cadenceA}
                        onChange={(e) => setCadenceA(Number(e.target.value))}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2 text-sm text-crm-text outline-none text-right pr-12 font-bold"
                        required
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-crm-muted font-bold pointer-events-none">days</span>
                    </div>
                  </div>
                </div>

                {/* Tier B */}
                <div className="grid grid-cols-3 gap-4 items-center border-b border-crm-border/60 pb-4">
                  <div className="col-span-2">
                    <h4 className="font-semibold text-sm text-crm-text">Tier B (Mid-Market Clients)</h4>
                    <p className="text-xs text-crm-muted">Standard mid-tier customers. Suggested meet interval.</p>
                  </div>
                  <div>
                    <div className="relative">
                      <input
                        type="number"
                        value={cadenceB}
                        onChange={(e) => setCadenceB(Number(e.target.value))}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2 text-sm text-crm-text outline-none text-right pr-12 font-bold"
                        required
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-crm-muted font-bold pointer-events-none">days</span>
                    </div>
                  </div>
                </div>

                {/* Tier C */}
                <div className="grid grid-cols-3 gap-4 items-center pb-2">
                  <div className="col-span-2">
                    <h4 className="font-semibold text-sm text-crm-text">Tier C (SMB Clients)</h4>
                    <p className="text-xs text-crm-muted">SME/small business customers. Suggested meet interval.</p>
                  </div>
                  <div>
                    <div className="relative">
                      <input
                        type="number"
                        value={cadenceC}
                        onChange={(e) => setCadenceC(Number(e.target.value))}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2 text-sm text-crm-text outline-none text-right pr-12 font-bold"
                        required
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-crm-muted font-bold pointer-events-none">days</span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-lg shadow-primary/10 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Apply Cadence Rules</span>
                </button>
              </div>
            </form>
          </div>

          {/* Operational helper info */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
            <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider mb-2 font-bold flex items-center space-x-2">
              <Sliders className="h-4 w-4" />
              <span>Automated Planning Operations</span>
            </h4>
            <p className="text-xs text-crm-muted leading-relaxed">
              The suggestions scheduler scans the database and calculates elapsed days since the last completed meeting for all active client contacts. If it exceeds these thresholds, suggested meetings will automatically populate in the salesperson's monthly planner.
            </p>
          </div>
        </div>

      </div>

      {/* Dynamic Meeting Outcomes Section */}
      <div className="bg-crm-card border border-crm-border rounded-2xl p-6 shadow-md space-y-6">
        <div className="flex items-center space-x-2 border-b border-crm-border/60 pb-3">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-crm-muted">Customisable Meeting Planner Outcomes</h3>
        </div>

        {outcomesSuccess && (
          <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{outcomesSuccess}</span>
          </div>
        )}

        {outcomesError && (
          <div className="px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{outcomesError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Outcomes list */}
          <div className="lg:col-span-2 space-y-4">
            <p className="text-xs text-crm-muted leading-relaxed">
              Define the available outcome selection statuses used when sales representatives complete scheduled visits. Standard options are fully editable, but deletions are blocked if the status is active in any touchpoint records.
            </p>

            <div className="border border-crm-border rounded-xl overflow-hidden bg-crm-bg/20 shadow-inner">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-crm-card border-b border-crm-border text-crm-muted uppercase tracking-wider font-bold">
                    <th className="py-3 px-4 font-bold text-[10px]">Outcome Status Name</th>
                    <th className="py-3 px-4 font-bold text-[10px]">Associated Workflow</th>
                    <th className="py-3 px-4 text-right font-bold text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-crm-border/60">
                  {outcomes.map(o => {
                    const inUse = isOutcomeInUse(o.label);
                    return (
                      <tr key={o.id} className="hover:bg-crm-card/50 transition">
                        <td className="py-3 px-4 font-semibold text-crm-text">{o.label}</td>
                        <td className="py-3 px-4 text-crm-muted">
                          {o.workflow === 'follow-up' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 border border-purple-500/25 text-purple-600 dark:text-purple-400">
                              Triggers Follow-up Meeting
                            </span>
                          )}
                          {o.workflow === 'not-interested' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400">
                              Requires Reason Comment
                            </span>
                          )}
                          {o.workflow === 'none' && (
                            <span className="text-slate-400 dark:text-slate-600 italic">None (Standard notes)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => startEditOutcome(o)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer inline-flex items-center"
                            title="Edit Outcome Status"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteOutcome(o.id)}
                            disabled={inUse}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center ${
                              inUse 
                                ? 'text-slate-300 dark:text-slate-800 cursor-not-allowed' 
                                : 'text-rose-500 hover:bg-rose-500/10'
                            }`}
                            title={inUse ? "Cannot delete: outcome is in use in meetings" : "Delete Outcome"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Add/Edit Form */}
          <div className="bg-crm-bg/40 border border-crm-border p-5 rounded-2xl space-y-4">
            <h4 className="text-xs font-bold text-crm-text uppercase tracking-wider flex items-center space-x-1.5">
              <span>{editingId ? 'Edit Outcome Status' : 'Add New Outcome Status'}</span>
            </h4>

            <form onSubmit={handleSaveOutcome} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-crm-muted uppercase tracking-wider">Display Label *</label>
                <input
                  type="text"
                  placeholder="e.g. Left Sample, Call Back Next Week"
                  value={outcomeLabel}
                  onChange={(e) => setOutcomeLabel(e.target.value)}
                  className="w-full bg-crm-card border border-crm-border focus:border-primary rounded-xl px-3 py-2 text-xs text-crm-text outline-none transition"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-crm-muted uppercase tracking-wider">Workflow Type *</label>
                <select
                  value={outcomeWorkflow}
                  onChange={(e) => setOutcomeWorkflow(e.target.value as CustomOutcome['workflow'])}
                  className="w-full bg-crm-card border border-crm-border focus:border-primary rounded-xl px-3 py-2.5 text-xs text-crm-text outline-none transition cursor-pointer"
                >
                  <option value="none">No special workflow (Just comments)</option>
                  <option value="follow-up">Schedule Follow-up (Conditionally prompts date picker)</option>
                  <option value="not-interested">Lack of Interest (Alters comment label to Reason)</option>
                </select>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center space-x-1 bg-primary hover:bg-primary-hover text-white py-2 px-3 rounded-xl text-xs font-bold transition shadow-md shadow-primary/10 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{editingId ? 'Save Changes' : 'Add Outcome'}</span>
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetOutcomeForm}
                    className="flex items-center justify-center space-x-1 bg-crm-card hover:bg-crm-border text-crm-text border border-crm-border py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Historical Alteration Warning Modal */}
      {confirmModalOpen && confirmModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-crm-card border border-crm-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up text-crm-text">
            <div className="flex items-center space-x-3 text-amber-500">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-md font-bold uppercase tracking-wider">Altering Historical Records</h3>
            </div>
            
            <p className="text-xs text-crm-muted leading-relaxed">
              You are changing the outcome label from <strong className="text-crm-text font-bold">"{confirmModalData.oldLabel}"</strong> to <strong className="text-crm-text font-bold">"{confirmModalData.newLabel}"</strong>.
            </p>
            <p className="text-xs text-crm-muted leading-relaxed">
              This action will permanently alter <strong className="text-primary font-bold">{confirmModalData.affectedCount}</strong> completed historical meeting record(s) matching this outcome in the database.
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => {
                  setConfirmModalOpen(false);
                  setConfirmModalData(null);
                }}
                className="bg-crm-bg hover:bg-crm-border border border-crm-border text-crm-text py-2 px-4 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmModalData.action}
                className="bg-primary hover:bg-primary-hover text-white py-2 px-4 rounded-xl text-xs font-bold transition shadow-md shadow-primary/10 cursor-pointer"
              >
                Proceed & Update Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
