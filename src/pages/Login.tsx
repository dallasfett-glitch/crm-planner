import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Key, Lock, Mail, LogIn } from 'lucide-react';

export const Login: React.FC = () => {
  const { signIn, isMockMode } = useAuth();
  const navigate = useNavigate();

  // Logo States
  const [logoLight] = useState(() => localStorage.getItem('crm_logo_light') || '/logo.png');
  const [logoDark] = useState(() => localStorage.getItem('crm_logo_dark') || '/logo.png');
  const [theme] = useState<'light' | 'dark'>(() => (localStorage.getItem('crm_theme') as 'light' | 'dark') || 'light');
  
  // Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
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
            Sign in to access your dashboard
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
                placeholder="admin@crmplanner.com"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-primary hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/10 active:bg-primary/90 text-white rounded-xl py-3 font-semibold text-sm transition-all duration-200 mt-6 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Account Provisioning Notice */}
        <div className="mt-6 text-center">
          <p className="text-crm-muted text-xs">
            Account access is provisioned by your system administrator.
          </p>
        </div>

        {/* Mock Mode Helper Box (Development Only) */}
        {isMockMode && import.meta.env.DEV && (
          <div className="mt-8 pt-6 border-t border-crm-border bg-primary/[0.03] p-4 rounded-2xl border border-primary/10">
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-primary mb-2 flex items-center space-x-1.5">
              <Key className="h-3 w-3" />
              <span>Demo Mode Admin Credentials</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-crm-muted">
              <li className="flex justify-between">
                <span>Administrator Email:</span>
                <strong className="text-crm-text">admin@crmplanner.com</strong>
              </li>
              <li className="flex justify-between">
                <span>Password:</span>
                <strong className="text-crm-text">admin123</strong>
              </li>
              <li className="text-crm-muted italic text-[10px] mt-1 text-center font-medium">
                * Sign in as admin to issue and manage user accounts.
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
