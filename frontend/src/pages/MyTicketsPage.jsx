import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ticketsApi } from '../api/ticketsApi';
import { aiApi } from '../api/aiApi';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import BadgeCard from '../components/tickets/BadgeCard';
import { 
  Ticket, 
  Sparkles, 
  AlertTriangle, 
  ChevronRight
} from 'lucide-react';

export default function MyTicketsPage() {
  const { isAuthenticated, user } = useAuth();
  const { error } = useToast();

  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  // AI recommendations state
  const [recommendations, setRecommendations] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);

  useEffect(() => {
    async function loadTickets() {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await ticketsApi.getMyTickets();
        const regs = data.registrations || [];
        setRegistrations(regs);
        if (regs.length > 0) {
          const firstEventId = regs[0].eventRef?._id || regs[0].eventRef;
          setSelectedEventId(firstEventId);
        }
      } catch (err) {
        error(err.message || 'Failed to fetch tickets.');
      } finally {
        setLoading(false);
      }
    }

    loadTickets();
  }, [isAuthenticated, error]);

  // Load AI recommendations when an event is selected
  useEffect(() => {
    async function fetchAiRecs() {
      if (!selectedEventId || !isAuthenticated) return;
      setLoadingAi(true);
      try {
        const data = await aiApi.getRecommendations(selectedEventId);
        setRecommendations(data.recommendations || data);
      } catch (err) {
        console.warn('AI recommendations not available:', err.message);
        setRecommendations(null);
      } finally {
        setLoadingAi(false);
      }
    }

    fetchAiRecs();
  }, [selectedEventId, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <Ticket className="w-16 h-16 text-brand-400 mx-auto" />
        <h2 className="text-2xl font-display font-bold text-white">Sign In to Access Your Passes</h2>
        <p className="text-sm text-slate-400">
          Sign in or use the quick role switcher in the header to view your cryptographically minted QR badges.
        </p>
        <Link to="/login" className="btn-primary inline-flex mt-2">
          Sign In Now
        </Link>
      </div>
    );
  }

  if (loading) return <LoadingSpinner text="Retrieving digital passes..." />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Page Title */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">Attendee Wallet</span>
        <h1 className="text-3xl font-display font-bold text-white mt-1">
          My Tickets & Digital Badges
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Show your cryptographic HMAC-SHA256 badge at the gate terminal or session room monitor for instant check-in.
        </p>
      </div>

      {registrations.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-400 space-y-3">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-200">No active event tickets found</h3>
          <p className="text-xs text-slate-400">You haven't reserved or claimed any passes yet.</p>
          <Link to="/events" className="btn-primary inline-flex text-xs py-2 px-4 mt-2">
            Browse Upcoming Summits
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Badges (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <Ticket className="w-5 h-5 text-brand-400" />
              Active Badges ({registrations.reduce((acc, r) => acc + (r.attendeePasses?.length || 1), 0)})
            </h3>

            <div className="space-y-6">
              {registrations.map((reg) => (
                <div key={reg._id} className="space-y-4">
                  {/* Event Name Tag */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-200">
                      {reg.eventRef?.title || 'Global Tech Concurrency Summit'}
                    </span>
                    <button
                      onClick={() => setSelectedEventId(reg.eventRef?._id || reg.eventRef)}
                      className="text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
                    >
                      AI Session Recommendations <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Badges List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reg.attendeePasses?.map((pass) => (
                      <BadgeCard key={pass._id || pass.passNumber} registration={reg} pass={pass} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: AI Personalized Recommendations */}
          <div className="space-y-4">
            <div className="glass-card p-6 border-brand-500/30 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="font-display font-bold text-white flex items-center gap-2 text-base">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                  AI Session Matcher
                </h3>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">
                  Jaccard $J(A, B)$
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Personalized recommendations matching your profile interests ({user?.interests?.join(', ') || 'AI, Cloud, Microservices'}) with zero schedule overlap.
              </p>

              {loadingAi ? (
                <LoadingSpinner size="sm" text="Computing Jaccard matches..." />
              ) : recommendations?.recommendedItinerary?.length > 0 ? (
                <div className="space-y-3">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Recommended Itinerary ({recommendations.recommendedItinerary.length})
                  </span>

                  {recommendations.recommendedItinerary.map((rec) => (
                    <div
                      key={rec.sessionId || rec.session?._id}
                      className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white line-clamp-1">
                          {rec.title || rec.session?.title}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-400 font-mono">
                          {Math.round((rec.similarityScore || 0.85) * 100)}% match
                        </span>
                      </div>

                      {rec.explanation && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {rec.explanation}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                        <span>Room: {rec.roomName || 'Grand Arena'}</span>
                        <span className="text-brand-300 font-medium">Conflict-Free</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-500">
                  No session recommendations found for this event track.
                </div>
              )}

              {/* Conflicting Alternatives (if any) */}
              {recommendations?.conflictingAlternatives?.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Conflicting Alternatives ({recommendations.conflictingAlternatives.length})</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    High interest similarity, but overlaps with a recommended talk.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
