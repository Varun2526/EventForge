import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi } from '../api/eventsApi';
import EventCard from '../components/events/EventCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { 
  Flame, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  Calendar, 
  Cpu 
} from 'lucide-react';

export default function HomePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await eventsApi.listEvents({ status: 'published' });
        setEvents(data.events || []);
      } catch (err) {
        console.error('Failed to load events:', err);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, []);

  return (
    <div className="space-y-24 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 md:pt-20">
        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-brand-600/30 to-brand-accent/20 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-5xl mx-auto text-center px-4 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-300 border border-brand-500/30 backdrop-blur-md shadow-glow-brand animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>Next-Gen Enterprise Event Orchestration Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-display font-extrabold tracking-tight text-white leading-[1.1]">
            Forge World-Class <br />
            <span className="bg-gradient-to-r from-brand-400 via-brand-accent to-brand-cyan bg-clip-text text-transparent">
              Conferences & Summits
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Full-stack MERN platform uniting multi-tier ticket reservations, cryptographic HMAC-SHA256 badge QR verification, AI-powered schedule optimization, and executive analytics.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link to="/events" className="btn-primary text-sm py-3 px-6 shadow-glow-brand">
              <Calendar className="w-4 h-4" />
              Explore All Events
            </Link>

            <Link to="/organizer" className="btn-secondary text-sm py-3 px-6">
              <Flame className="w-4 h-4 text-brand-400" />
              Launch Organizer Studio
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 max-w-4xl mx-auto">
            <div className="glass-card p-4 text-center">
              <span className="text-2xl font-display font-bold text-white block">144 / 144</span>
              <span className="text-xs text-slate-400">Verified Test Invariants</span>
            </div>
            <div className="glass-card p-4 text-center">
              <span className="text-2xl font-display font-bold text-brand-cyan block">&lt; 50ms</span>
              <span className="text-xs text-slate-400">QR Gate Verification</span>
            </div>
            <div className="glass-card p-4 text-center">
              <span className="text-2xl font-display font-bold text-emerald-400 block">100%</span>
              <span className="text-xs text-slate-400">ACID Inventory Locks</span>
            </div>
            <div className="glass-card p-4 text-center">
              <span className="text-2xl font-display font-bold text-brand-accent block">AI Copilot</span>
              <span className="text-xs text-slate-400">Generative Agenda & Copy</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Events Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">Live Summits & Conferences</span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mt-1">
              Featured Events
            </h2>
          </div>
          <Link to="/events" className="btn-outline text-xs self-start sm:self-auto">
            View All Events <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner text="Fetching active conferences..." />
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.slice(0, 6).map((ev) => (
              <EventCard key={ev._id} event={ev} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-12 text-center text-slate-400">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-200">No events currently scheduled</h3>
            <p className="text-xs text-slate-400 mt-1">Check back soon or create one in the Organizer Studio.</p>
          </div>
        )}
      </section>

      {/* Platform Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">Engineered for Reliability</span>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mt-1">
            Engineered Across All 6 Architectural Phases
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-display font-bold text-white">2-Phase Inventory & Holds</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              15-minute transactional checkout holds with automatic expiration cascade and deterministic FIFO waitlist promotion.
            </p>
          </div>

          <div className="glass-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-display font-bold text-white">HMAC-SHA256 Badge Tokens</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cryptographically signed QR tokens prevent tampering, replay attacks, and duplicate door check-ins with sub-second latency.
            </p>
          </div>

          <div className="glass-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-display font-bold text-white">AI-Powered Orchestration</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Jaccard similarity session recommendations for attendees, automated schedule conflict detection, and generative copy tools.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
