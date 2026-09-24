import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock3, Compass, LockKeyhole, MapPin, Sparkles } from 'lucide-react';
import { aiApi } from '../api/aiApi';
import { eventsApi } from '../api/eventsApi';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

function formatSessionTime(startTime, endTime) {
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  const timeOptions = { hour: 'numeric', minute: '2-digit' };
  const start = new Date(startTime);
  const end = new Date(endTime);
  return `${start.toLocaleDateString('en-US', dateOptions)} · ${start.toLocaleTimeString('en-US', timeOptions)}–${end.toLocaleTimeString('en-US', timeOptions)}`;
}

function RecommendationCard({ item, alternative = false }) {
  const session = item.session || item;
  const isFull = item.isFull || session.enrolledCount >= session.capacityLimit;

  return (
    <article className={`relative rounded-2xl border p-5 ${alternative ? 'border-slate-800 bg-slate-900/40' : 'border-brand-500/30 bg-brand-500/[0.07] shadow-glow-brand'}`}>
      {!alternative && <div className="absolute left-0 top-5 h-14 w-1 rounded-r-full bg-brand-400" />}
      <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="badge border border-brand-500/30 bg-brand-500/10 text-brand-300">{session.track || 'General'}</span>
            <span className="text-xs font-mono text-slate-500">{item.matchPercentage ?? 0}% match</span>
          </div>
          <h2 className="font-display text-lg font-bold text-white">{session.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.explanation || session.description}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isFull ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
          {isFull ? 'Full' : `${Math.max(0, (session.capacityLimit || 0) - (session.enrolledCount || 0))} seats open`}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-800/80 pt-4 pl-2 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-brand-400" />{formatSessionTime(session.startTime, session.endTime)}</span>
        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand-cyan" />{session.roomName || 'Room to be announced'}</span>
        {alternative && item.conflictsWith && <span className="text-amber-300">Conflicts with {item.conflictsWith.title}</span>}
      </div>
    </article>
  );
}

export default function MyAgendaPage() {
  const { isAuthenticated } = useAuth();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [recommendations, setRecommendations] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    eventsApi.listEvents({ status: 'published' })
      .then((data) => {
        const list = data.events || [];
        setEvents(list);
        setEventId(list[0]?._id || '');
      })
      .catch(() => setError('We could not load events for recommendations.'))
      .finally(() => setLoadingEvents(false));
  }, []);

  useEffect(() => {
    if (!eventId || !isAuthenticated) return;
    // oxlint-disable-next-line react(set-state-in-effect)
    setLoadingAgenda(true);
    setError('');
    aiApi.getRecommendations(eventId)
      .then(setRecommendations)
      .catch((requestError) => setError(requestError.message || 'Recommendations are unavailable right now.'))
      .finally(() => setLoadingAgenda(false));
  }, [eventId, isAuthenticated]);

  const selectedEvent = useMemo(() => events.find((event) => event._id === eventId), [events, eventId]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="glass-card p-8">
          <LockKeyhole className="mx-auto h-8 w-8 text-brand-400" />
          <h1 className="mt-4 font-display text-2xl font-bold text-white">Your agenda is personal.</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in to receive a conflict-aware session itinerary based on your interests.</p>
          <Link to="/login" className="btn-primary mt-6 text-sm">Sign in to build my agenda</Link>
        </div>
      </div>
    );
  }

  if (loadingEvents) return <LoadingSpinner text="Finding events for your itinerary..." />;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-3xl border border-brand-500/20 bg-surface p-7 sm:p-9">
        <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-300"><Sparkles className="h-3.5 w-3.5" />AI itinerary</span>
            <h1 className="mt-2 font-display text-3xl font-bold text-white">Your best next sessions</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">A conflict-free route through the event, ranked from your interests and attendance history.</p>
          </div>
          <label className="block min-w-56 text-xs font-semibold text-slate-300">Event
            <select value={eventId} onChange={(event) => setEventId(event.target.value)} className="input-field mt-1.5 bg-slate-950 text-sm">
              {events.map((event) => <option key={event._id} value={event._id}>{event.title}</option>)}
            </select>
          </label>
        </div>
      </header>

      {!selectedEvent ? (
        <div className="glass-card p-10 text-center text-slate-400"><CalendarDays className="mx-auto mb-3 h-10 w-10 text-slate-600" />No published events are available yet.</div>
      ) : loadingAgenda ? <LoadingSpinner text="Building your conflict-free route..." /> : error ? (
        <div className="glass-card border-rose-500/30 p-6 text-sm text-rose-200">{error}</div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white">Recommended itinerary</h2>
              <span className="text-xs text-slate-500">{recommendations?.recommendedItinerary?.length || 0} sessions</span>
            </div>
            {recommendations?.recommendedItinerary?.length ? recommendations.recommendedItinerary.map((item) => <RecommendationCard key={item.sessionId} item={item} />) : (
              <div className="glass-card p-8 text-center text-slate-400"><Compass className="mx-auto mb-3 h-8 w-8 text-brand-400" />No scheduled sessions match this event yet.</div>
            )}
          </section>
          <aside className="space-y-5">
            <div className="glass-card p-5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <h2 className="mt-3 font-display font-bold text-white">No overlap</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Each primary recommendation has been checked against the sessions above, so your plan remains possible to attend.</p>
            </div>
            {recommendations?.conflictingAlternatives?.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-display text-base font-bold text-white">Strong alternatives</h2>
                {recommendations.conflictingAlternatives.map((item) => <RecommendationCard key={item.sessionId} item={item} alternative />)}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
