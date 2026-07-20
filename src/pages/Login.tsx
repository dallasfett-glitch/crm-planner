import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Key, Lock, Mail, UserPlus, LogIn, User } from 'lucide-react';

export const Login: React.FC = () => {
  const { signIn, signUp, isMockMode } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);

  // Logo States
  const [logoLight] = useState(() => localStorage.getItem('crm_logo_light') || '/logo.png');
  const [logoDark] = useState(() => localStorage.getItem('crm_logo_dark') || '/logo.png');
  const [theme] = useState<'light' | 'dark'>(() => (localStorage.getItem('crm_theme') as 'light' | 'dark') || 'light');
  
  // Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'salesperson' | 'admin'>('salesperson');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!displayName.trim()) {
          throw new Error('Please enter a display name.');
        }
        await signUp(email, password, displayName, role);
      } else {
        await signIn(email, password);
      }
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-crm-bg flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-200">
      {/* Background blobs for premium depth */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md bg-crm-card border border-crm-border p-8 rounded-3xl shadow-2xl text-crm-text transition-all">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-6">
            <img 
              src={theme === 'dark' ? logoDark : logoLight} 
              alt="EMU Australia Logo" 
              className={`h-14 w-auto object-contain ${
                (theme === 'dark' && (!logoDark || logoDark === '/logo.png')) ? 'dark:invert' : ''
              }`} 
            />
          </div>
          <p className="text-crm-muted text-sm text-center font-medium">
            {isSignUp ? 'Create your salesperson profile' : 'Sign in to access your dashboard'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">
                Display Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-crm-muted">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl pl-10 pr-4 py-3 text-sm text-crm-text placeholder-crm-muted/50 outline-none transition"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-crm-muted">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                placeholder="salesperson@crmplanner.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl pl-10 pr-4 py-3 text-sm text-crm-text placeholder-crm-muted/50 outline-none transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-crm-muted">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl pl-10 pr-4 py-3 text-sm text-crm-text placeholder-crm-muted/50 outline-none transition"
                required
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">
                Account Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('salesperson')}
                  className={`py-2 px-4 rounded-xl border text-sm font-semibold transition ${
                    role === 'salesperson'
                      ? 'bg-primary/10 border-primary text-primary shadow-sm'
                      : 'border-crm-border text-crm-muted hover:border-crm-muted/40 hover:text-crm-text'
                  }`}
                >
                  Salesperson
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`py-2 px-4 rounded-xl border text-sm font-semibold transition ${
                    role === 'admin'
                      ? 'bg-primary/10 border-primary text-primary shadow-sm'
                      : 'border-crm-border text-crm-muted hover:border-crm-muted/40 hover:text-crm-text'
                  }`}
                >
                  Administrator
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-primary hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/10 active:bg-primary/90 text-white rounded-xl py-3 font-semibold text-sm transition-all duration-200 mt-6 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin" />
            ) : isSignUp ? (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Create Account</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Toggle Sign Up / Log In */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-primary hover:text-primary-hover text-xs font-semibold hover:underline bg-transparent border-none outline-none cursor-pointer"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
          </button>
        </div>

        {/* Mock Mode Helper Box */}
        {isMockMode && (
          <div className="mt-8 pt-6 border-t border-crm-border bg-primary/[0.03] p-4 rounded-2xl border border-primary/10">
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-primary mb-2 flex items-center space-x-1.5">
              <Key className="h-3 w-3" />
              <span>Demo Mode seeded accounts</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-crm-muted">
              <li className="flex justify-between">
                <span>Salesperson:</span>
                <strong className="text-crm-text">sales@crmplanner.com</strong>
              </li>
              <li className="flex justify-between">
                <span>Administrator:</span>
                <strong className="text-crm-text">admin@crmplanner.com</strong>
              </li>
              <li className="text-crm-muted italic text-[10px] mt-1 text-center font-medium">
                * Type any password to sign in.
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
