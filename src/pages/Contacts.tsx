import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useContactStore, type Contact } from '../stores/useContactStore';
import { useCompanyStore } from '../stores/useCompanyStore';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, User, Mail, Phone, Building2, Edit, Trash2, X, AlertCircle, MapPin, Loader2 } from 'lucide-react';
import { AddressForm } from '../components/AddressForm';
import { COUNTRY_STATES } from '../utils/addressConstants';
import { geocodeStructuredAddress, type GeocodingMatch } from '../utils/geocoding';

type ContactSaveData = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;

export const Contacts: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load stores
  const contacts = useContactStore(state => state.contacts);
  const contactsLoading = useContactStore(state => state.loading);
  const addContact = useContactStore(state => state.addContact);
  const updateContact = useContactStore(state => state.updateContact);
  const deleteContact = useContactStore(state => state.deleteContact);

  const companies = useCompanyStore(state => state.companies);
  const initCompanies = useCompanyStore(state => state.initialize);

  useEffect(() => {
    const unsubComp = initCompanies();
    return () => unsubComp();
  }, [initCompanies]);

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<'prospect' | 'client' | 'inactive'>('prospect');
  const [tier, setTier] = useState<'A' | 'B' | 'C'>('B'); // Default Tier
  const [companyId, setCompanyId] = useState('');
  const [primaryOwner, setPrimaryOwner] = useState('John Salesperson');
  const [street, setStreet] = useState('');
  const [suburb, setSuburb] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [postcode, setPostcode] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);

  // Pre-save geocoding intercept and disambiguation modal states
  const [disambiguationOpen, setDisambiguationOpen] = useState(false);
  const [disambiguationMatches, setDisambiguationMatches] = useState<GeocodingMatch[]>([]);
  const [pendingSaveData, setPendingSaveData] = useState<ContactSaveData | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);

  // Filter contacts based on search query
  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tier.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setEmail('');
    setPhone('');
    setRole('');
    setStatus('prospect');
    setTier('B');
    setPrimaryOwner('John Salesperson');
    setStreet('');
    setSuburb('');
    setState('');
    setCountry('');
    setPostcode('');
    setLatitude(undefined);
    setLongitude(undefined);
    // Default to first company if available
    setCompanyId(companies[0]?.id || '');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (c: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setName(c.name);
    setEmail(c.email);
    setPhone(c.phone);
    setRole(c.role);
    setStatus(c.status);
    setTier(c.tier || 'B');
    setCompanyId(c.companyId);
    setPrimaryOwner(c.primaryOwner || 'John Salesperson');
    setStreet(c.street || '');
    setSuburb(c.suburb || '');
    setState(c.state || '');
    setCountry(c.country || '');
    setPostcode(c.postcode || '');
    setLatitude(c.latitude);
    setLongitude(c.longitude);
    setFormError(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        await deleteContact(id);
      } catch (err) {
        console.error('Failed to delete contact:', err);
      }
    }
  };

  const proceedWithSave = async (data: ContactSaveData) => {
    try {
      if (editingId) {
        await updateContact(editingId, data);
      } else {
        await addContact(data);
      }
      setModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error saving contact.');
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
    setSuburb(cityOrSuburb || '');
    setState(stateVal || '');
    setCountry(countryVal || '');
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
      setFormError('Please enter a name.');
      return;
    }
    if (!companyId) {
      setFormError('Please select or create a company first.');
      return;
    }

    // If any address overrides are entered, Suburb is required
    const hasAddress = !!(street.trim() || suburb.trim() || state.trim() || country.trim() || postcode.trim());
    if (hasAddress && !suburb.trim()) {
      setFormError('Suburb/City is required when entering address details.');
      return;
    }

    const selectedCompany = companies.find(c => c.id === companyId);
    const companyName = selectedCompany ? selectedCompany.name : 'Unknown';

    const contactData = {
      name,
      email,
      phone,
      role,
      status,
      tier,
      companyId,
      companyName,
      assignedSalespersonId: user?.uid || '',
      primaryOwner,
      street: street.trim(),
      suburb: suburb.trim(),
      state: state.trim(),
      country: country.trim(),
      postcode: postcode.trim(),
      latitude,
      longitude,
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
          contactData.latitude = isNaN(lat) ? undefined : lat;
          contactData.longitude = isNaN(lon) ? undefined : lon;
          await proceedWithSave(contactData);
        } else {
          // Low confidence match -> block and open disambiguation validation modal
          setPendingSaveData(contactData);
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
      // No custom address entered or coordinates are already resolved by autocomplete selection
      await proceedWithSave(contactData);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-crm-text">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-crm-text">Contacts</h1>
          <p className="text-crm-muted text-sm mt-0.5">Manage contacts and communications histories</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition shadow-lg shadow-primary/10"
        >
          <Plus className="h-4 w-4" />
          <span>Add Contact</span>
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
            placeholder="Filter by name, company, email, role, tier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl pl-10 pr-4 py-2 text-sm text-crm-text placeholder-crm-muted outline-none transition"
          />
        </div>
      </div>

      {/* Table grid listing */}
      {contactsLoading ? (
        <div className="text-center py-20">
          <div className="w-10 h-10 border-4 border-crm-border border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-crm-muted text-sm">Loading contacts...</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-16 bg-crm-card border border-crm-border rounded-2xl">
          <User className="h-12 w-12 text-crm-muted mx-auto mb-4 animate-bounce" />
          <p className="text-crm-text font-bold text-lg">No contacts found</p>
          <p className="text-crm-muted text-sm mt-1">Try another filter keyword or add a new contact.</p>
        </div>
      ) : (
        <div className="bg-crm-card border border-crm-border rounded-2xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-crm-border bg-crm-bg/40 text-crm-muted font-bold text-xs uppercase tracking-wider">
                  <th className="py-4 px-6">Contact Name</th>
                  <th className="py-4 px-6">Company</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Account Tier</th>
                  <th className="py-4 px-6">Email / Phone</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crm-border/60">
                {filteredContacts.map((c) => (
                  <tr 
                    key={c.id}
                    onClick={() => navigate(`/contacts/${c.id}`)}
                    className="hover:bg-crm-bg/40 cursor-pointer transition text-crm-text"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-primary font-bold shadow-inner">
                          {c.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-crm-text">{c.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-crm-text flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-crm-muted shrink-0" />
                        <span className="font-semibold hover:underline hover:text-primary" onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/companies/${c.companyId}`);
                        }}>
                          {c.companyName}
                        </span>
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-crm-text font-medium">{c.role || 'N/A'}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        c.tier === 'A' 
                          ? 'bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400' 
                          : c.tier === 'B'
                          ? 'bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-500/10 border-slate-500/25 text-slate-600 dark:text-slate-400'
                      }`}>
                        Tier {c.tier}
                      </span>
                    </td>
                    <td className="py-4 px-6 space-y-1">
                      <span className="text-xs text-crm-text flex items-center space-x-1.5 font-medium">
                        <Mail className="h-3.5 w-3.5 text-crm-muted shrink-0" />
                        <span>{c.email}</span>
                      </span>
                      {c.phone && (
                        <span className="text-xs text-crm-muted flex items-center space-x-1.5">
                          <Phone className="h-3.5 w-3.5 text-crm-muted shrink-0" />
                          <span>{c.phone}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border ${
                        c.status === 'client' 
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' 
                          : c.status === 'prospect'
                          ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
                          : 'bg-crm-bg border-crm-border text-crm-muted'
                      }`}>
                        {c.status}
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

      {/* CRUD Modal */}
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
              {editingId ? 'Edit Contact' : 'Add New Contact'}
            </h3>
            <p className="text-xs text-crm-muted mb-6">Enter contact specifications</p>

            {formError && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* Left Column: Core Contact Information */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Contact Information</h4>
                  <div>
                    <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Contact Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted outline-none transition"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Email</label>
                      <input
                        type="email"
                        placeholder="e.g. john@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Phone</label>
                      <input
                        type="text"
                        placeholder="e.g. 1-800-555-0199"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Role / Title</label>
                      <input
                        type="text"
                        placeholder="e.g. CEO or Manager"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted outline-none transition"
                      />
                    </div>
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Lead Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as 'prospect' | 'client' | 'inactive')}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                      >
                        <option value="prospect">Prospect</option>
                        <option value="client">Client</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Account Tier *</label>
                      <select
                        value={tier}
                        onChange={(e) => setTier(e.target.value as 'A' | 'B' | 'C')}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                        required
                      >
                        <option value="A">Tier A (Enterprise - 30d)</option>
                        <option value="B">Tier B (Mid-Market - 60d)</option>
                        <option value="C">Tier C (SMB - 90d)</option>
                      </select>
                    </div>
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

                {/* Right Column: Custom Location */}
                <div className="space-y-4 bg-crm-bg/20 p-5 rounded-2xl border border-crm-border">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Custom Location (Optional Override)</h4>
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
                  {editingId ? 'Save Changes' : 'Create Contact'}
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
