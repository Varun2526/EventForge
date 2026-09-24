import React from 'react';
import { Clock, MapPin, User, Users } from 'lucide-react';

export default function SessionTimeline({ sessions = [] }) {
  if (!sessions.length) {
    return (
      <div className="text-center py-12 glass-card p-6 border-dashed border-slate-800">
        <Clock className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-slate-300">No scheduled sessions yet</h4>
        <p className="text-xs text-slate-500 mt-1">Sessions and talk tracks will appear once announced.</p>
      </div>
    );
  }

  // Sort sessions chronologically
  const sortedSessions = [...sessions].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return (
    <div className="space-y-4">
      {sortedSessions.map((session) => {
        const start = new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const end = new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isFull = (session.enrolledCount || 0) >= (session.capacityLimit || 999);

        return (
          <div
            key={session._id}
            className="glass-card p-5 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-300 border border-brand-500/20">
                  <Clock className="w-3 h-3" /> {start} – {end}
                </span>

                {session.track && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    Track: {session.track}
                  </span>
                )}

                {isFull && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    Session Full
                  </span>
                )}
              </div>

              <h4 className="text-base font-semibold text-white">{session.title}</h4>

              {session.description && (
                <p className="text-xs text-slate-400 line-clamp-2">{session.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                {session.roomName && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-cyan" />
                    <span>Room: {session.roomName}</span>
                  </div>
                )}

                {session.speakerProfileRef?.name && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    <span>{session.speakerProfileRef.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance Cap */}
            <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-end gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {session.enrolledCount || 0} / {session.capacityLimit}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">Admitted</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
