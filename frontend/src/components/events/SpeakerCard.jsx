import React from 'react';
import { User, Briefcase } from 'lucide-react';

export default function SpeakerCard({ speaker }) {
  return (
    <div className="glass-card p-5 flex flex-col justify-between hover:border-brand-500/30 transition-all">
      <div className="flex items-start gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-500 to-brand-accent p-0.5 shrink-0 shadow-sm">
          <div className="w-full h-full bg-surface rounded-[10px] flex items-center justify-center text-brand-300 font-bold text-lg">
            {speaker.fullName ? speaker.fullName.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-base font-semibold text-white truncate">{speaker.fullName}</h4>
          <p className="text-xs text-brand-300 truncate font-medium">{speaker.headline || speaker.position || 'Keynote Speaker'}</p>
          {speaker.company && (
            <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
              <Briefcase className="w-3 h-3 text-slate-500" />
              {speaker.company}
            </p>
          )}
        </div>
      </div>

      {speaker.bio && (
        <p className="text-xs text-slate-400 mt-3 line-clamp-3 leading-relaxed">
          {speaker.bio}
        </p>
      )}

      {speaker.topics && speaker.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-slate-800/80">
          {speaker.topics.map((topic, idx) => (
            <span
              key={idx}
              className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium"
            >
              {topic}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
