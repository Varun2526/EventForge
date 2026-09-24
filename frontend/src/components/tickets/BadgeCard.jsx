import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, Copy, Check } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export default function BadgeCard({ registration, pass }) {
  const [copied, setCopied] = useState(false);
  const { success } = useToast();

  const badgeToken = pass.qrCodePayload || '';
  const isCheckedIn = pass.checkedIn;

  const handleCopy = () => {
    if (!badgeToken) return;
    navigator.clipboard.writeText(badgeToken);
    setCopied(true);
    success('Cryptographic QR token copied to clipboard! Ready to paste into Gate Check-In scanner.');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="glass-card gradient-border overflow-hidden flex flex-col justify-between shadow-card hover:border-brand-500/40 transition-all">
      {/* Top Banner */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-brand-400" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Pass Badge</span>
            <span className="text-xs font-mono font-bold text-white">{pass.passNumber}</span>
          </div>
        </div>

        <span
          className={`badge border text-[10px] ${
            isCheckedIn
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}
        >
          {isCheckedIn ? 'Checked In' : 'Pending Gate Scan'}
        </span>
      </div>

      {/* Main Content */}
      <div className="p-6 flex flex-col md:flex-row items-center gap-6">
        {/* QR Code Presentation */}
        <div className="p-3.5 rounded-2xl bg-white shadow-glow-brand shrink-0 flex items-center justify-center">
          {badgeToken ? (
            <QRCodeSVG
              value={badgeToken}
              size={135}
              level="M"
              includeMargin={false}
            />
          ) : (
            <div className="w-[135px] h-[135px] bg-slate-200 flex items-center justify-center text-slate-500 text-xs">
              No QR
            </div>
          )}
        </div>

        {/* Pass Details */}
        <div className="space-y-2 flex-1 text-center md:text-left">
          <div>
            <h4 className="text-lg font-display font-bold text-white leading-snug">
              {pass.holderName || registration.attendeeDetails?.firstName + ' ' + registration.attendeeDetails?.lastName}
            </h4>
            <p className="text-xs text-brand-300 font-medium">
              {pass.holderEmail || registration.attendeeDetails?.email}
            </p>
          </div>

          <div className="space-y-1 text-xs text-slate-400 pt-1">
            <p className="flex items-center justify-center md:justify-start gap-1.5">
              <span className="text-slate-500">Tier:</span>
              <span className="font-semibold text-slate-200">{registration.ticketTierRef?.name || 'Standard Pass'}</span>
            </p>
            <p className="flex items-center justify-center md:justify-start gap-1.5 font-mono">
              <span className="text-slate-500">Reg:</span>
              <span className="text-slate-300">{registration.registrationNumber}</span>
            </p>
          </div>

          {/* Quick Copy Token Button */}
          {badgeToken && (
            <div className="pt-2">
              <button
                onClick={handleCopy}
                className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                title="Copy cryptographic token for gate scanner testing"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-brand-400" />}
                <span>{copied ? 'Token Copied!' : 'Copy Badge Token for Gate Scanner'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-5 py-2.5 bg-slate-900/60 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
        <span>HMAC-SHA256 Cryptographically Signed</span>
        <span className="text-brand-400/80 font-mono">EFB1 Standard</span>
      </div>
    </div>
  );
}
