import React, { useState, useEffect } from 'react';
import { eventsApi } from '../api/eventsApi';
import EventCard from '../components/events/EventCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Search, Calendar } from 'lucide-react';

const EVENT_TYPES = ['all', 'conference', 'workshop', 'exhibition', 'webinar', 'corporate_meet'];

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
        const params = {};
        if (search) params.search = search;
        if (selectedType !== 'all') params.type = selectedType;
        const data = await eventsApi.listEvents(params);
        setEvents(data.events || []);
      } catch (err) {
        console.error('Failed to load events:', err);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(fetchEvents, 250);
    return () => clearTimeout(timer);
  }, [search, selectedType]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Title & Header */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">Discover Opportunities</span>
        <h1 className="text-3xl font-display font-bold text-white mt-1">
          Explore Conferences & Summits
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-xl">
          Browse upcoming corporate events, multi-track symposiums, and hands-on technical workshops.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 glass-card p-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event title, description, or keyword..."
            className="input-field pl-10 text-sm"
          />
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                selectedType === type
                  ? 'bg-brand-500 text-white shadow-glow-brand'
                  : 'bg-surface hover:bg-surface-hover text-slate-300 border border-slate-800'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <LoadingSpinner text="Loading events..." />
      ) : events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((ev) => (
            <EventCard key={ev._id} event={ev} />
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center text-slate-400">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-200">No events matched your criteria</h3>
          <p className="text-xs text-slate-400 mt-1">Try refining your search keyword or clearing the filters.</p>
        </div>
      )}
    </div>
  );
}
