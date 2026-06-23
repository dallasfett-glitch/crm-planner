import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useCompanyStore, type Company } from '../stores/useCompanyStore';
import { useContactStore } from '../stores/useContactStore';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Building2, Globe, Phone, Edit, Trash2, X, AlertCircle, Trash, MapPin, Loader2 } from 'lucide-react';
import { AddressForm } from '../components/AddressForm';
import { COUNTRY_STATES } from '../utils/addressConstants';
import { geocodeStructuredAddress, type GeocodingMatch } from '../utils/geocoding';

interface StagedContact {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  tier: 'A' | 'B' | 'C';
  status: 'prospect' | 'client';
}

type CompanySaveData = Omit<Company, 'id' | 'createdAt' | 'updatedAt'>;

export const Companies: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const companies = useCompanyStore(state => state.companies);
  const loading = useCompanyStore(state => state.loading);
  const addCompany = useCompanyStore(state => state.addCompany);
  const updateCompany = useCompanyStore(state => state.updateCompany);
  const deleteCompany = useCompanyStore(state => state.deleteCompany);
  const addContact = useContactStore(state => state.addContact);

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State - Split Address Fields
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [suburb, setSuburb] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [postcode, setPostcode] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [tier, setTier] = useState<'A' | 'B' | 'C'>('B');
  const [primaryOwner, setPrimaryOwner] = useState('John Salesperson');

  // Pre-save geocoding intercept and disambiguation modal states
  const [disambiguationOpen, setDisambiguationOpen] = useState(false);
  const [disambiguationMatches, setDisambiguationMatches] = useState<GeocodingMatch[]>([]);
  const [pendingSaveData, setPendingSaveData] = useState<CompanySaveData | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Inline Staged Contacts for Company Creation
  const [stagedContacts, setStagedContacts] = useState<StagedContact[]>([]);
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cRole, setCRole] = useState('');
  const [cTier, setCTier] = useState<'A' | 'B' | 'C'>('B');
  const [cStatus, setCStatus] = useState<'prospect' | 'client'>('prospect');

  const [formError, setFormError] = useState<string | null>(null);

  // Filter companies based on search
  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setDomain('');
    setIndustry('');
    setPhone('');
    setStreet('');
    setSuburb('');
    setState('');
    setCountry('');
    setPostcode('');
    setLatitude(undefined);
    setLongitude(undefined);
    setTier('B');
    setPrimaryOwner('John Salesperson');
    setStagedContacts([]);
    setCName('');
    setCEmail('');
    setCPhone('');
    setCRole('');
    setCTier('B');
    setCStatus('prospect');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (c: Company, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid navigating to detail page on click
    setEditingId(c.id);
    setName(c.name);
    setDomain(c.domain);
    setIndustry(c.industry);
    setPhone(c.phone);
    setStreet(c.street || '');
    setSuburb(c.suburb || '');
    setState(c.state || '');
    setCountry(c.country || '');
    setPostcode(c.postcode || '');
    setLatitude(c.latitude);
    setLongitude(c.longitude);
    setTier(c.tier || 'B');
    setPrimaryOwner(c.primaryOwner || 'John Salesperson');
    setStagedContacts([]);
    setFormError(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this company? All associated contacts and deals will need updating.')) {
      try {
        await deleteCompany(id);
      } catch (err) {
        console.error('Failed to delete company:', err);
      }
    }
  };

  const proceedWithSave = async (data: CompanySaveData) => {
    try {
      if (editingId) {
        await updateCompany(editingId, data);
      } else {
        const newCompId = await addCompany(data);
        
        // Save inline staged contacts linked to this company
        for (const c of stagedContacts) {
          await addContact({
            name: c.name,
            email: c.email,
            phone: c.phone,
            role: c.role,
            status: c.status,
            tier: c.tier,
            companyId: newCompId,
            companyName: name,
            assignedSalespersonId: user?.uid || '',
            primaryOwner: primaryOwner,
          });
        }
      }
      setModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error saving company.');
    }
  };

  const handleSelectMatch = async (match: GeocodingMatch) => {
    if (!pendingSaveData) return;

    const lat = parseFloat(match.lat);
    const lon = parseFloat(match.lon);

    const addr = match.address || {};
    const houseNumber = addr.house_number ? `${addr.house_number} ` : '';
    const road = addr.road || '';
    const streetVal = `${houseNumber}${road}`.trim() || match.display_name.split(',')[0];
    const cityOrSuburb = addr.suburb || addr.city || addr.town || addr.village || pendingSaveData.suburb;
    
    // Resolve ISO Country code
    const rawCountryCode = (addr.country_code || '').toUpperCase();
    let countryVal = pendingSaveData.country;
    if (rawCountryCode) {
      countryVal = rawCountryCode;
    }

    // Resolve state ISO code if mapped
    const rawState = addr.state || addr.province || '';
    const stateVal = (countryVal && COUNTRY_STATES[countryVal])
      ? (COUNTRY_STATES[countryVal].find(
          s => s.value.toLowerCase() === rawState.toLowerCase().trim() || s.label.toLowerCase().includes(rawState.toLowerCase().trim())
        )?.value || rawState)
      : (rawState || pendingSaveData.state);

    const postcodeVal = addr.postcode || pendingSaveData.postcode;

    const finalData = {
      ...pendingSaveData,
      street: streetVal,
      suburb: cityOrSuburb,
      state: stateVal,
      country: countryVal,
      postcode: postcodeVal,
      latitude: isNaN(lat) ? undefined : lat,
      longitude: isNaN(lon) ? undefined : lon,
    };

    // Update form states so the UI stays in sync
    setStreet(streetVal);
    setSuburb(cityOrSuburb);
    setState(stateVal);
    setCountry(countryVal);
    setPostcode(postcodeVal || '');
    setLatitude(isNaN(lat) ? undefined : lat);
    setLongitude(isNaN(lon) ? undefined : lon);

    setDisambiguationOpen(false);
    setPendingSaveData(null);
    await proceedWithSave(finalData);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Please enter a company name.');
      return;
    }

    // If any address fields are entered, Suburb is required
    const hasAddress = !!(street.trim() || suburb.trim() || state.trim() || country.trim() || postcode.trim());
    if (hasAddress && !suburb.trim()) {
      setFormError('Suburb/City is required when entering address details.');
      return;
    }

    const companyData = {
      name,
      domain,
      industry,
      phone,
      street: street.trim(),
      suburb: suburb.trim(),
      state: state.trim(),
      country: country.trim(),
      postcode: postcode.trim(),
      latitude,
      longitude,
      tier,
      primaryOwner,
      assignedSalespersonId: user?.uid || '',
    };

    if (hasAddress && (latitude === undefined || longitude === undefined)) {
      setIsGeocoding(true);
      try {
        const matches = await geocodeStructuredAddress({
          street: street.trim(),
          suburb: suburb.trim(),
          state: state.trim(),
          country: country.trim(),
          postcode: postcode.trim(),
        });

        if (!matches || matches.length === 0) {
          setFormError('Geocoding verification failed: No matching locations found. Please check spelling or details.');
          setIsGeocoding(false);
          return;
        }

        const topMatch = matches[0];
        const confidence = topMatch.importance || 0;

        // If high confidence match or only 1 match, save directly
        if (confidence >= 0.90 || matches.length === 1) {
          const lat = parseFloat(topMatch.lat);
          const lon = parseFloat(topMatch.lon);
          companyData.latitude = isNaN(lat) ? undefined : lat;
          companyData.longitude = isNaN(lon) ? undefined : lon;
          await proceedWithSave(companyData);
        } else {
          // Low confidence match -> block and open disambiguation validation modal
          setPendingSaveData(companyData);
          setDisambiguationMatches(matches.slice(0, 3));
          setDisambiguationOpen(true);
        }
      } catch (err: unknown) {
        console.error(err);
        setFormError(err instanceof Error ? err.message : 'Geocoding failed due to connection error or timeout.');
      } finally {
        setIsGeocoding(false);
      }
    } else {
      // No address entered or coordinates are already resolved by autocomplete selection
      await proceedWithSave(companyData);
    }
  };

  // Helper to print global standard address format
  const formatAddress = (c: Company) => {
    if (!c.street && !c.suburb && !c.state && !c.country && !c.postcode) return 'No address';
    return `${c.street || 'N/A'}, ${c.suburb || 'N/A'}, ${c.state || 'N/A'}, ${c.country || 'N/A'} ${c.postcode || ''}`.trim();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-crm-text">Companies</h1>
          <p className="text-crm-muted text-sm mt-0.5">Manage accounts and companies in your sales pipeline</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition shadow-lg shadow-primary/10"
        >
          <Plus className="h-4 w-4" />
          <span>Add Company</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex bg-crm-card border border-crm-border rounded-2xl p-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-crm-muted">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Filter by name, domain, industry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl pl-10 pr-4 py-2 text-sm text-crm-text placeholder-crm-muted outline-none transition"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="text-center py-20">
          <div className="w-10 h-10 border-4 border-crm-border border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-crm-muted text-sm">Loading companies...</p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="text-center py-16 bg-crm-card border border-crm-border rounded-2xl">
          <Building2 className="h-12 w-12 text-crm-muted mx-auto mb-4 animate-bounce" />
          <p className="text-crm-text font-bold text-lg">No companies found</p>
          <p className="text-crm-muted text-sm mt-1">Try another filter keyword or add a new company.</p>
        </div>
      ) : (
        /* Companies Table Card */
        <div className="bg-crm-card border border-crm-border rounded-2xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-crm-border bg-crm-bg/40 text-crm-muted font-bold text-xs uppercase tracking-wider">
                  <th className="py-4 px-6">Company Info</th>
                  <th className="py-4 px-6">Tier</th>
                  <th className="py-4 px-6">Industry</th>
                  <th className="py-4 px-6">Phone</th>
                  <th className="py-4 px-6">Global Standard Address</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crm-border/60">
                {filteredCompanies.map((c) => (
                  <tr 
                    key={c.id}
                    onClick={() => navigate(`/companies/${c.id}`)}
                    className="hover:bg-crm-bg/40 cursor-pointer transition text-crm-text"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/15 shadow-sm">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-crm-text">{c.name}</p>
                          <a 
                            href={`https://${c.domain}`} 
                            target="_blank" 
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-crm-muted hover:text-primary transition flex items-center space-x-1.5 mt-0.5"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            <span>{c.domain}</span>
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        c.tier === 'A' 
                          ? 'bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400' 
                          : c.tier === 'B'
                          ? 'bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-500/10 border-slate-500/25 text-slate-600 dark:text-slate-400'
                      }`}>
                        Tier {c.tier || 'B'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs bg-crm-bg border border-crm-border text-crm-muted px-2.5 py-1 rounded-full font-medium capitalize">
                        {c.industry || 'N/A'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {c.phone ? (
                        <span className="text-sm text-crm-text flex items-center space-x-1.5">
                          <Phone className="h-3.5 w-3.5 text-crm-muted" />
                          <span>{c.phone}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-crm-muted italic">No phone</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs text-crm-muted block max-w-[280px] leading-relaxed break-words font-medium">
                        {formatAddress(c)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={(e) => openEditModal(c, e)}
                          className="p-1.5 rounded-lg text-crm-muted hover:text-primary hover:bg-crm-bg border border-transparent hover:border-crm-border transition shadow-sm"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(c.id, e)}
                          className="p-1.5 rounded-lg text-crm-muted hover:text-rose-500 hover:bg-rose-500/5 border border-transparent hover:border-rose-500/10 transition shadow-sm"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CRUD Add/Edit Modal */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="w-full max-w-4xl max-h-[95vh] overflow-y-auto bg-crm-card border border-crm-border rounded-3xl p-6 shadow-2xl relative text-crm-text animate-fade-in scrollbar-thin">
            <button 
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-crm-text mb-2">
              {editingId ? 'Edit Company' : 'Add New Company'}
            </h3>
            <p className="text-xs text-crm-muted mb-6">Enter company specifications and client status details</p>

            {formError && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* Left Column: Company Information */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Company Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Company Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Tesla"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted/60 outline-none transition"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Company Tier *</label>
                      <select
                        value={tier}
                        onChange={(e) => {
                          const selectedTier = e.target.value as 'A' | 'B' | 'C';
                          setTier(selectedTier);
                          setCTier(selectedTier); // default contact tier to company tier
                        }}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                      >
                        <option value="A">Tier A (Enterprise - 30d Touchpoint)</option>
                        <option value="B">Tier B (Mid-Market - 60d Touchpoint)</option>
                        <option value="C">Tier C (SMB - 90d Touchpoint)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Domain</label>
                      <input
                        type="text"
                        placeholder="e.g. tesla.com"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted/60 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Industry</label>
                      <input
                        type="text"
                        placeholder="e.g. Automotive"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
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
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted/60 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Primary Owner *</label>
                      <select
                        value={primaryOwner}
                        onChange={(e) => setPrimaryOwner(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                        required
                      >
                        <option value="John Salesperson">John Salesperson</option>
                        <option value="Admin User">Admin User</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Right Column: Office Address */}
                <div className="space-y-4 bg-crm-bg/20 p-5 rounded-2xl border border-crm-border">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Office Address</h4>
                  <AddressForm
                    value={{ street, suburb, state, country, postcode, latitude, longitude }}
                    onChange={(val) => {
                      setStreet(val.street);
                      setSuburb(val.suburb);
                      setState(val.state);
                      setCountry(val.country);
                      setPostcode(val.postcode);
                      setLatitude(val.latitude);
                      setLongitude(val.longitude);
                    }}
                  />
                </div>
              </div>

              {/* Inline Contacts Stage Section (Only for Company ADD) */}
              {!editingId && (
                <div className="border-t border-crm-border/60 pt-6 space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Associate Contacts Inline</h4>
                  
                  <div className="bg-crm-bg/70 p-4 rounded-2xl border border-crm-border space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-crm-muted uppercase tracking-wider mb-1">Contact Name</label>
                        <input
                          type="text"
                          placeholder="e.g. John Doe"
                          value={cName}
                          onChange={(e) => setCName(e.target.value)}
                          className="w-full bg-crm-card border border-crm-border focus:border-primary rounded-lg px-3 py-1.5 text-xs text-crm-text placeholder-crm-muted/60 outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-crm-muted uppercase tracking-wider mb-1">Email Address</label>
                        <input
                          type="email"
                          placeholder="e.g. john@tesla.com"
                          value={cEmail}
                          onChange={(e) => setCEmail(e.target.value)}
                          className="w-full bg-crm-card border border-crm-border focus:border-primary rounded-lg px-3 py-1.5 text-xs text-crm-text placeholder-crm-muted/60 outline-none transition"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-crm-muted uppercase tracking-wider mb-1">Phone</label>
                        <input
                          type="text"
                          placeholder="e.g. 555-1234"
                          value={cPhone}
                          onChange={(e) => setCPhone(e.target.value)}
                          className="w-full bg-crm-card border border-crm-border focus:border-primary rounded-lg px-3 py-1.5 text-xs text-crm-text placeholder-crm-muted/60 outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-crm-muted uppercase tracking-wider mb-1">Role</label>
                        <input
                          type="text"
                          placeholder="e.g. VP Sales"
                          value={cRole}
                          onChange={(e) => setCRole(e.target.value)}
                          className="w-full bg-crm-card border border-crm-border focus:border-primary rounded-lg px-3 py-1.5 text-xs text-crm-text placeholder-crm-muted/60 outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-crm-muted uppercase tracking-wider mb-1">Tier</label>
                        <select
                          value={cTier}
                          onChange={(e) => setCTier(e.target.value as 'A' | 'B' | 'C')}
                          className="w-full bg-crm-card border border-crm-border focus:border-primary rounded-lg px-2 py-1.5 text-xs text-crm-text outline-none transition"
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <div className="flex items-center space-x-2">
                        <label className="text-[10px] font-semibold text-crm-muted uppercase tracking-wider">Status:</label>
                        <select
                          value={cStatus}
                          onChange={(e) => setCStatus(e.target.value as 'prospect' | 'client')}
                          className="bg-crm-card border border-crm-border focus:border-primary rounded-lg px-2 py-1 text-xs text-crm-text outline-none transition"
                        >
                          <option value="prospect">Prospect</option>
                          <option value="client">Client</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!cName.trim() || !cEmail.trim()) {
                            alert('Contact name and email are required to stage.');
                            return;
                          }
                          const newStaged = {
                            id: `staged-${Date.now()}`,
                            name: cName.trim(),
                            email: cEmail.trim(),
                            phone: cPhone.trim(),
                            role: cRole.trim(),
                            tier: cTier,
                            status: cStatus,
                          };
                          setStagedContacts([...stagedContacts, newStaged]);
                          setCName('');
                          setCEmail('');
                          setCPhone('');
                          setCRole('');
                        }}
                        className="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                      >
                        Stage Contact
                      </button>
                    </div>
                  </div>

                  {stagedContacts.length > 0 && (
                    <div className="bg-crm-bg/50 border border-crm-border p-3 rounded-2xl">
                      <p className="text-[10px] uppercase font-bold text-crm-muted tracking-wider mb-2">Staged Contacts ({stagedContacts.length})</p>
                      <div className="max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin">
                        {stagedContacts.map((sc) => (
                          <div key={sc.id} className="flex justify-between items-center text-xs bg-crm-card border border-crm-border p-2.5 rounded-xl">
                            <div>
                              <p className="font-semibold text-crm-text">{sc.name} ({sc.role || 'No role'})</p>
                              <p className="text-[10px] text-crm-muted mt-0.5">{sc.email} &bull; Tier {sc.tier} &bull; {sc.status}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setStagedContacts(stagedContacts.filter(s => s.id !== sc.id))}
                              className="text-crm-muted hover:text-rose-500 p-1 rounded-lg transition"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex space-x-3 pt-4 border-t border-crm-border/60">
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
                  {editingId ? 'Save Changes' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Geocoding Loading Indicator */}
      {isGeocoding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-crm-card border border-crm-border p-6 rounded-2xl shadow-2xl flex flex-col items-center space-y-4 max-w-xs text-center text-crm-text animate-fade-in">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-semibold">Verifying location address...</p>
            <p className="text-xs text-crm-muted">Consulting spatial mapping databases</p>
          </div>
        </div>
      )}

      {/* Disambiguation Modal (FR-03) */}
      {disambiguationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-crm-card border border-crm-border rounded-3xl p-6 shadow-2xl relative text-crm-text animate-scale-in">
            <button 
              onClick={() => {
                setDisambiguationOpen(false);
                setPendingSaveData(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-crm-text mb-2">Location Disambiguation</h3>
            <p className="text-xs text-crm-muted mb-4">
              We found multiple locations matching your input with low confidence. Please select the correct result to confirm your location:
            </p>

            <div className="space-y-2 mb-6">
              {disambiguationMatches.map((match, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectMatch(match)}
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
                  setPendingSaveData(null);
                }}
                className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-xs border border-crm-border transition shadow-sm"
              >
                Cancel Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
