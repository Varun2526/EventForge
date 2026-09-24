import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, SEED_PERSONAS } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Flame, LogIn, Lock, Mail, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, loginAsSeed } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      success('Logged in successfully!');
      navigate('/events');
    } catch (err) {
      error(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (roleKey) => {
    setLoading(true);
    try {
      const user = await loginAsSeed(roleKey);
      success(`Logged in as ${user.name} (${roleKey})!`);
      navigate('/events');
    } catch (err) {
      error(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md glass-card gradient-border p-8 shadow-card space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-accent p-0.5 mx-auto shadow-glow-brand">
            <div className="w-full h-full bg-surface rounded-[10px] flex items-center justify-center">
              <Flame className="w-6 h-6 text-brand-400" />
            </div>
          </div>
          <h2 className="text-2xl font-display font-bold text-white">Sign In to EventForge</h2>
          <p className="text-xs text-slate-400">Manage conferences, tickets, and gate check-in</p>
        </div>

        {/* 1-Click Fast Persona Switcher */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-brand-300">
              <Sparkles className="w-3.5 h-3.5 text-brand-400" /> 1-Click Seed Accounts
            </span>
            <span>Password123!</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {SEED_PERSONAS.slice(0, 4).map((p) => (
              <button
                key={p.roleKey}
                type="button"
                onClick={() => handleQuickLogin(p.roleKey)}
                disabled={loading}
                className="p-2 rounded-lg bg-surface hover:bg-brand-500/10 border border-slate-800 hover:border-brand-500/40 text-left transition-all group"
              >
                <span className="text-[11px] font-semibold text-white group-hover:text-brand-300 block truncate">
                  {p.label}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Standard Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="input-field pl-10 text-xs py-2.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="input-field pl-10 text-xs py-2.5"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 font-semibold text-xs flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-400 hover:text-brand-300 font-semibold">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
