import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, ArrowRight, Tag } from 'lucide-react';

export default function EventCard({ event }) {
  const startDate = new Date(event.startDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const capacityPercent = Math.min(
    100,
    Math.round(((event.registeredCount || 0) / (event.totalCapacity || 1)) * 100)
  );

  const statusColors = {
    published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    ongoing: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse',
    completed: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    draft: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  };

  return (
    <div className="glass-card flex flex-col justify-between overflow-hidden group hover:-translate-y-1">
      {/* Event Header Banner Accent */}
      <div className="h-3 bg-gradient-to-r from-brand-600 via-brand-accent to-brand-cyan" />

      <div className="p-6 flex-1 flex flex-col">
        {/* Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`badge border ${statusColors[event.status] || statusColors.published}`}>
            {event.status}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-300 flex items-center gap-1 bg-brand-500/10 px-2.5 py-1 rounded-md border border-brand-500/20">
            <Tag className="w-3 h-3" /> {event.type}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-display font-bold text-white mb-2 group-hover:text-brand-300 transition-colors line-clamp-2">
          {event.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-slate-400 mb-4 line-clamp-2 leading-relaxed">
          {event.description || 'Join industry leaders and practitioners for an intensive, high-impact summit.'}
        </p>

        {/* Metadata Details */}
        <div className="space-y-2 mt-auto text-xs text-slate-300 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-400 shrink-0" />
            <span>{startDate}</span>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand-cyan shrink-0" />
            <span className="truncate">{event.venueRef?.name || 'Grand Arena Convention Center'}</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Users className="w-4 h-4 text-slate-400" />
              <span>
                {event.registeredCount || 0} / {event.totalCapacity} attendees
              </span>
            </div>
            <span className="font-semibold text-slate-200">{capacityPercent}%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-brand-accent rounded-full transition-all duration-500"
              style={{ width: `${capacityPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="px-6 py-4 bg-slate-900/40 border-t border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">Tickets available</span>
        <Link
          to={`/events/${event._id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400 group-hover:text-brand-300 group-hover:translate-x-0.5 transition-all"
        >
          View & Register <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
