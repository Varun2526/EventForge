import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, SEED_PERSONAS } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { 
  Flame, 
  Ticket, 
  Calendar, 
  QrCode, 
  BarChart3, 
  Sparkles, 
  UserCheck, 
  LogOut, 
  LogIn, 
  ChevronDown,
  LayoutDashboard,
  ListChecks
} from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, logout, loginAsSeed } = useAuth();
  const { success, error } = useToast();
  const location = useLocation();
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  const isActive = (path) => {
    return location.pathname === path ? 'text-brand-400 font-semibold bg-brand-500/10' : 'text-slate-300 hover:text-white hover:bg-slate-800/40';
  };

  const handleSeedSelect = async (roleKey) => {
    try {
      setShowPersonaMenu(false);
      const loggedInUser = await loginAsSeed(roleKey);
      success(`Switched role to ${loggedInUser.name} (${roleKey})`);
    } catch (err) {
      error(`Role switch failed: ${err.message}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-accent p-0.5 shadow-glow-brand group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-surface rounded-[10px] flex items-center justify-center">
              <Flame className="w-5 h-5 text-brand-400" />
            </div>
          </div>
          <div>
            <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-brand-300 bg-clip-text text-transparent">
              EventForge
            </span>
            <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
              v2.1
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-1">
          <Link to="/events" className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${isActive('/events')}`}>
            <Calendar className="w-4 h-4" />
            Events
          </Link>
          
          <Link to="/my-tickets" className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${isActive('/my-tickets')}`}>
            <Ticket className="w-4 h-4" />
            My Tickets
          </Link>

          <Link to="/my-agenda" className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${isActive('/my-agenda')}`}>
            <ListChecks className="w-4 h-4" />
            My Agenda
          </Link>

          <Link to="/organizer" className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${isActive('/organizer')}`}>
            <LayoutDashboard className="w-4 h-4" />
            Organizer
          </Link>

          <Link to="/checkin" className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${isActive('/checkin')}`}>
            <QrCode className="w-4 h-4" />
            Gate Check-In
          </Link>

          <Link to="/analytics" className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${isActive('/analytics')}`}>
            <BarChart3 className="w-4 h-4" />
            Analytics
          </Link>
        </nav>

        {/* Right Action: Persona Switcher & Auth */}
        <div className="flex items-center gap-3">
          {/* Quick Demo Persona Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPersonaMenu(!showPersonaMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-medium text-slate-200 shadow-sm transition-all"
              title="Quickly switch between pre-seeded demo roles"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span className="hidden sm:inline">Role Switcher:</span>
              <span className="text-brand-300 font-semibold uppercase">{user?.globalRole || 'Select'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {showPersonaMenu && (
              <div className="absolute right-0 mt-2 w-72 glass-card border border-slate-700/80 p-2 shadow-card z-50 animate-fade-in">
                <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase border-b border-slate-800/80 mb-1">
                  1-Click Seed Switcher
                </div>
                {SEED_PERSONAS.map((p) => (
                  <button
                    key={p.roleKey}
                    onClick={() => handleSeedSelect(p.roleKey)}
                    className="w-full text-left p-2 rounded-lg hover:bg-brand-500/10 transition-colors flex items-start gap-2.5 group"
                  >
                    <UserCheck className="w-4 h-4 text-brand-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{p.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium uppercase ${p.badgeClass}`}>
                          {p.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{p.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auth State */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-medium text-slate-200">{user?.name}</span>
                <span className="text-[10px] text-slate-400">{user?.email}</span>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-primary text-xs py-2 px-3.5">
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </Link>
          )}
        </div>
      </div>

      <nav className="md:hidden flex items-center gap-1 overflow-x-auto border-t border-slate-800/70 px-3 py-2 custom-scrollbar" aria-label="Mobile navigation">
        <Link to="/events" className={`shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors ${isActive('/events')}`}>Events</Link>
        <Link to="/my-tickets" className={`shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors ${isActive('/my-tickets')}`}>Tickets</Link>
        <Link to="/my-agenda" className={`shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors ${isActive('/my-agenda')}`}>My Agenda</Link>
        <Link to="/organizer" className={`shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors ${isActive('/organizer')}`}>Organizer</Link>
        <Link to="/checkin" className={`shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors ${isActive('/checkin')}`}>Check-in</Link>
        <Link to="/analytics" className={`shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors ${isActive('/analytics')}`}>Analytics</Link>
      </nav>
    </header>
  );
}
