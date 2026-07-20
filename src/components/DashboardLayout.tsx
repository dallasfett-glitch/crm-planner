import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Briefcase, 
  Calendar, 
  LogOut, 
  Search, 
  Menu, 
  X, 
  User,
  ExternalLink,
  Sun,
  Moon,
  Sliders,
  Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useContactStore, type Contact } from '../stores/useContactStore';
import { useCompanyStore, type Company } from '../stores/useCompanyStore';
import { useDealStore, type Deal } from '../stores/useDealStore';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, signOut, isMockMode } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('crm_theme') as 'light' | 'dark') || 'light';
  });

  // Custom Logo Reactive States
  const [logoLight, setLogoLight] = useState(() => localStorage.getItem('crm_logo_light') || '/logo.png');
  const [logoDark, setLogoDark] = useState(() => localStorage.getItem('crm_logo_dark') || '/logo.png');
  const [logoIcon, setLogoIcon] = useState(() => localStorage.getItem('CRM Planner_logo_icon') || '');

  useEffect(() => {
    const handleLogoUpdate = () => {
      setLogoLight(localStorage.getItem('crm_logo_light') || '/logo.png');
      setLogoDark(localStorage.getItem('crm_logo_dark') || '/logo.png');
      setLogoIcon(localStorage.getItem('CRM Planner_logo_icon') || '');
    };
    window.addEventListener('crm-logo-updated', handleLogoUpdate);
    return () => window.removeEventListener('crm-logo-updated', handleLogoUpdate);
  }, []);

  // Apply theme class to document element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('crm_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Get store states
  const contacts = useContactStore(state => state.contacts);
  const companies = useCompanyStore(state => state.companies);
  const deals = useDealStore(state => state.deals);

  // Initialize stores
  const initContacts = useContactStore(state => state.initialize);
  const initCompanies = useCompanyStore(state => state.initialize);
  const initDeals = useDealStore(state => state.initialize);

  useEffect(() => {
    const unsubContacts = initContacts();
    const unsubCompanies = initCompanies();
    const unsubDeals = initDeals();

    return () => {
      unsubContacts();
      unsubCompanies();
      unsubDeals();
    };
  }, [initContacts, initCompanies, initDeals]);

  // Derive search results directly during render to prevent cascading renders
  const searchResults = React.useMemo<{
    contacts: Contact[];
    companies: Company[];
    deals: Deal[];
  }>(() => {
    if (searchQuery.trim().length < 2) {
      return { contacts: [], companies: [], deals: [] };
    }

    const query = searchQuery.toLowerCase();
    
    const filteredContacts = contacts.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.email.toLowerCase().includes(query) ||
      c.role.toLowerCase().includes(query)
    ).slice(0, 5);

    const filteredCompanies = companies.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.domain.toLowerCase().includes(query) ||
      c.industry.toLowerCase().includes(query)
    ).slice(0, 5);

    const filteredDeals = deals.filter(d => 
      d.name.toLowerCase().includes(query) ||
      d.stage.toLowerCase().includes(query) ||
      d.companyName.toLowerCase().includes(query)
    ).slice(0, 5);

    return {
      contacts: filteredContacts,
      companies: filteredCompanies,
      deals: filteredDeals
    };
  }, [searchQuery, contacts, companies, deals]);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Contacts', href: '/contacts', icon: Users },
    { name: 'Companies', href: '/companies', icon: Building2 },
    { name: 'Deals Board', href: '/deals', icon: Briefcase },
    { name: 'Meeting Planner', href: '/meetings', icon: Calendar },
    { name: 'Compliance', href: '/compliance', icon: Shield },
  ];

  // If permitted, add Link to configurations. User Management is strictly Admin only.
  if (user?.role === 'admin' || user?.permissions?.canManageCadences) {
    navigation.push({ name: 'Settings', href: '/admin/settings', icon: Sliders });
  }
  if (user?.role === 'admin') {
    navigation.push({ name: 'User Management', href: '/admin/users', icon: Shield });
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  };

  const hasResults = searchResults.contacts.length > 0 || 
                     searchResults.companies.length > 0 || 
                     searchResults.deals.length > 0;

  return (
    <div className="min-h-screen bg-crm-bg text-crm-text flex flex-col md:flex-row transition-colors duration-200">
      {/* Mobile Header */}
      <header className="md:hidden bg-crm-card border-b border-crm-border px-4 py-3 flex items-center justify-between z-30">
        <div className="flex items-center">
          {logoIcon ? (
            <img src={logoIcon} alt="App Icon" className="h-8 w-8 object-contain rounded-lg" />
          ) : (
            <img 
              src={theme === 'dark' ? logoDark : logoLight} 
              alt="EMU Australia Logo" 
              className={`h-8 w-auto object-contain ${
                (!logoLight || logoLight === '/logo.png') && theme === 'dark' ? 'dark:invert' : ''
              }`} 
            />
          )}
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-crm-muted hover:text-crm-text focus:outline-none"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>
 
      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 transition-transform duration-300 ease-in-out
        w-64 bg-crm-card border-r border-crm-border flex flex-col justify-between z-40 md:z-10
      `}>
        <div>
          {/* Logo Brand */}
          <div className="hidden md:flex items-center px-6 py-5 border-b border-crm-border">
            <img 
              src={theme === 'dark' ? logoDark : logoLight} 
              alt="EMU Australia Logo" 
              className={`h-10 w-auto object-contain ${
                (theme === 'dark' && (!logoDark || logoDark === '/logo.png')) ? 'dark:invert' : ''
              }`} 
            />
          </div>

          {/* Navigation Links */}
          <nav className="px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                               (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-205
                    ${isActive 
                      ? 'bg-primary/10 border-l-4 border-primary text-primary shadow-sm shadow-primary/5' 
                      : 'text-crm-muted hover:bg-crm-bg hover:text-crm-text border-l-4 border-transparent'}
                  `}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-crm-muted'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-crm-border bg-crm-bg/10">
          {isMockMode && (
            <div className="mb-3 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/25 text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">
                Demo Mock Mode
              </span>
            </div>
          )}
          
          <div className="flex items-center space-x-3 px-3 py-2 rounded-xl bg-crm-bg border border-crm-border mb-3 shadow-inner">
            <div className="h-9 w-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold shadow-inner">
              {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-crm-text truncate">{user?.displayName}</p>
              <p className="text-xs text-crm-muted truncate capitalize">{user?.role}</p>
            </div>
          </div>

          {/* Theme switcher toggle widget directly below user avatar */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-crm-bg border border-crm-border mb-3">
            <span className="text-xs font-semibold text-crm-muted">Visual Theme</span>
            <button
              onClick={toggleTheme}
              className="p-1 rounded bg-crm-card hover:bg-crm-border border border-crm-border text-primary transition-all shadow-sm"
              title="Toggle Light/Dark Mode"
            >
              {theme === 'light' ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
            </button>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-crm-muted hover:text-rose-500 hover:bg-rose-500/5 border border-transparent hover:border-rose-500/10 transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-crm-card/75 backdrop-blur-md border-b border-crm-border px-6 py-4 flex items-center justify-between sticky top-0 z-20 transition-colors">
          {/* Global Search Bar */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-crm-muted">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search contacts, companies, deals..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="w-full bg-crm-bg border border-crm-border hover:border-crm-muted/40 focus:border-primary rounded-xl pl-10 pr-4 py-2 text-sm text-crm-text placeholder-crm-muted outline-none transition-all"
            />
            {/* Search Results Dropdown */}
            {showSearchResults && searchQuery.trim().length >= 2 && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowSearchResults(false)}
                />
                <div className="absolute left-0 right-0 mt-2 bg-crm-card border border-crm-border rounded-2xl shadow-2xl p-4 max-h-[400px] overflow-y-auto z-50 backdrop-blur-xl">
                  {hasResults ? (
                    <div className="space-y-4">
                      {/* Contacts Results */}
                      {searchResults.contacts.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-crm-muted uppercase tracking-wider mb-1 px-2">Contacts</h4>
                          <ul className="space-y-1">
                            {searchResults.contacts.map(c => (
                              <li key={c.id}>
                                <button
                                  onClick={() => {
                                    setShowSearchResults(false);
                                    setSearchQuery('');
                                    navigate(`/contacts/${c.id}`);
                                  }}
                                  className="w-full text-left flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-crm-bg transition"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-crm-text">{c.name}</p>
                                    <p className="text-xs text-crm-muted">{c.companyName} &bull; {c.role}</p>
                                  </div>
                                  <ExternalLink className="h-3.5 w-3.5 text-crm-muted" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Companies Results */}
                      {searchResults.companies.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-crm-muted uppercase tracking-wider mb-1 px-2">Companies</h4>
                          <ul className="space-y-1">
                            {searchResults.companies.map(c => (
                              <li key={c.id}>
                                <button
                                  onClick={() => {
                                    setShowSearchResults(false);
                                    setSearchQuery('');
                                    navigate(`/companies/${c.id}`);
                                  }}
                                  className="w-full text-left flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-crm-bg transition"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-crm-text">{c.name}</p>
                                    <p className="text-xs text-crm-muted">{c.industry} &bull; {c.domain}</p>
                                  </div>
                                  <ExternalLink className="h-3.5 w-3.5 text-crm-muted" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Deals Results */}
                      {searchResults.deals.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-crm-muted uppercase tracking-wider mb-1 px-2">Deals</h4>
                          <ul className="space-y-1">
                            {searchResults.deals.map(d => (
                              <li key={d.id}>
                                <button
                                  onClick={() => {
                                    setShowSearchResults(false);
                                    setSearchQuery('');
                                    navigate(`/deals`);
                                  }}
                                  className="w-full text-left flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-crm-bg transition"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-crm-text">{d.name}</p>
                                    <p className="text-xs text-crm-muted">{d.companyName} &bull; ${d.value.toLocaleString()}</p>
                                  </div>
                                  <ExternalLink className="h-3.5 w-3.5 text-crm-muted" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-crm-muted text-sm">
                      No matching results found for "{searchQuery}"
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs bg-crm-bg text-crm-muted px-3 py-1 rounded-full border border-crm-border">
              Role: <strong className="text-primary capitalize">{user?.role}</strong>
            </span>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
