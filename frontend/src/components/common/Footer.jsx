import React from 'react';
import { Flame, Shield, Cpu, Database, CheckCircle2 } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-surface/50 backdrop-blur-md mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <Flame className="w-4 h-4 text-brand-400" />
            </div>
            <div>
              <span className="font-display font-bold text-white text-base">EventForge</span>
              <p className="text-xs text-slate-400">Enterprise MERN Event Orchestration & Cryptographic Gate Verification</p>
            </div>
          </div>

          {/* Tech Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Database className="w-3 h-3" /> MongoDB rs0
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
              <Cpu className="w-3 h-3" /> Express.js 5
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
              <Shield className="w-3 h-3" /> HMAC-SHA256 QR
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 144 Verified Tests
            </span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} EventForge Platform. All rights reserved.</p>
          <div className="flex gap-6">
            <span className="hover:text-slate-400 transition-colors cursor-pointer">Architecture v2.1</span>
            <span className="hover:text-slate-400 transition-colors cursor-pointer">Security Protocol</span>
            <span className="hover:text-slate-400 transition-colors cursor-pointer">API Reference</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
