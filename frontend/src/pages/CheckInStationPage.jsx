import React, { useState, useEffect } from 'react';
import { checkInApi } from '../api/checkInApi';
import { eventsApi } from '../api/eventsApi';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  QrCode, 
  DoorOpen, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle
} from 'lucide-react';

export default function CheckInStationPage() {
  const { isStaff, user } = useAuth();
  const { success, error, warning, info } = useToast();

  const [stationMode, setStationMode] = useState('gate'); // 'gate' | 'session'
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Result state
  const [scanResult, setScanResult] = useState(null);

  // Events & Sessions for Room Monitor
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');

  // Load events list for session selection
  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await eventsApi.listEvents({ status: 'published' });
        const list = data.events || [];
        setEvents(list);
        if (list.length > 0) {
          setSelectedEventId(list[0]._id);
        }
      } catch (err) {
        console.error('Failed to load events:', err);
      }
    }
    loadEvents();
  }, []);

  // Load sessions when event changes
  useEffect(() => {
    async function loadSessions() {
      if (!selectedEventId) return;
      try {
        const data = await eventsApi.listSessions(selectedEventId);
        const list = data.sessions || [];
        setSessions(list);
        if (list.length > 0) {
          setSelectedSessionId(list[0]._id);
        } else {
          setSelectedSessionId('');
        }
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    }
    loadSessions();
  }, [selectedEventId]);

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      warning('Please enter or paste a cryptographic badge token.');
      return;
    }

    setLoading(true);
    setScanResult(null);

    try {
      if (stationMode === 'gate') {
        const result = await checkInApi.gateCheckIn({
          token: tokenInput.trim(),
          deviceId: `terminal-gate-${user?._id || '01'}`,
        });

        setScanResult({
          type: 'gate',
          status: result.status,
          message: result.message || 'Attendee passed gate verification.',
          data: result,
        });

        if (result.status === 'already_checked_in') {
          warning('Badge already checked in! Duplicate scan recorded safely.');
        } else {
          success('Gate entry authorized! Attendee checked in.');
        }
      } else {
        if (!selectedSessionId) {
          warning('Please select a session room first.');
          setLoading(false);
          return;
        }

        const result = await checkInApi.sessionCheckIn({
          token: tokenInput.trim(),
          sessionId: selectedSessionId,
          deviceId: `terminal-room-${user?._id || '01'}`,
        });

        setScanResult({
          type: 'session',
          status: result.status,
          message: result.message || 'Session room entry granted.',
          data: result,
        });

        if (result.status === 'already_attended') {
          info('Attendee has already checked into this session.');
        } else {
          success('Session room admission granted! Enrolled count updated.');
        }

        // Refresh session capacity
        const refreshedData = await eventsApi.listSessions(selectedEventId);
        setSessions(refreshedData.sessions || []);
      }
    } catch (err) {
      setScanResult({
        type: stationMode,
        status: 'rejected',
        message: err.message || 'Check-in rejected.',
        code: err.code,
      });
      error(`Check-in rejected: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedSession = sessions.find((s) => s._id === selectedSessionId);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-cyan">Operational Staff Portal</span>
          <h1 className="text-3xl font-display font-bold text-white mt-1">
            Gate & Session Check-In Station
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sub-second HMAC-SHA256 badge verification with gate check-in prerequisites and capacity limits.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1 self-start sm:self-auto shrink-0">
          <button
            onClick={() => {
              setStationMode('gate');
              setScanResult(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              stationMode === 'gate' ? 'bg-brand-500 text-white shadow-glow-brand' : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            Main Gate
          </button>
          <button
            onClick={() => {
              setStationMode('session');
              setScanResult(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              stationMode === 'session' ? 'bg-brand-500 text-white shadow-glow-brand' : 'text-slate-400 hover:text-white'
            }`}
          >
            <DoorOpen className="w-3.5 h-3.5" />
            Session Room Door
          </button>
        </div>
      </div>

      {/* Staff Authorization Notice if not staff */}
      {!isStaff && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Currently logged in as attendee. Switch to "Event Staff" or "Organizer" using the top bar Role Switcher for official operations.</span>
          </div>
        </div>
      )}

      {/* Main Terminal Card */}
      <div className="glass-card gradient-border p-6 md:p-8 space-y-6">
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-cyan/20 border border-brand-cyan/30 flex items-center justify-center text-brand-cyan">
              {stationMode === 'gate' ? <QrCode className="w-5 h-5" /> : <DoorOpen className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-base">
                {stationMode === 'gate' ? 'Gate Admission Terminal' : 'Session Room Check-In'}
              </h3>
              <span className="text-[11px] text-slate-400">
                {stationMode === 'gate' ? 'Verifying event-level admission' : 'Enforcing gate prerequisite & room cap'}
              </span>
            </div>
          </div>

          <span className="text-[10px] font-mono bg-slate-800 text-emerald-400 border border-slate-700 px-2 py-0.5 rounded">
            SCANNER ONLINE
          </span>
        </div>

        {/* If Room Mode: Select Event & Session */}
        {stationMode === 'session' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800 animate-fade-in">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Event</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="input-field text-xs py-2 bg-slate-900"
              >
                {events.map((ev) => (
                  <option key={ev._id} value={ev._id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Session Room</label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="input-field text-xs py-2 bg-slate-900"
              >
                {sessions.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.title} ({s.roomName || 'Room'}) — {s.enrolledCount || 0}/{s.capacityLimit}
                  </option>
                ))}
              </select>
            </div>

            {selectedSession && (
              <div className="sm:col-span-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Room Capacity Limit: <strong className="text-white">{selectedSession.capacityLimit}</strong></span>
                <span>Current Enrolled Headcount: <strong className="text-emerald-400">{selectedSession.enrolledCount || 0}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Scanner Form */}
        <form onSubmit={handleScanSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Badge Token (EFB1.&lt;payload&gt;.&lt;signature&gt;)</span>
              <span className="text-[11px] text-brand-400 font-normal">
                Paste token copied from My Tickets badge
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste cryptographic badge token here..."
                className="input-field font-mono text-xs py-3 pr-24"
              />
              <button
                type="submit"
                disabled={loading || !tokenInput.trim()}
                className="btn-primary absolute right-1.5 top-1.5 bottom-1.5 text-xs px-4"
              >
                {loading ? 'Verifying...' : 'Scan / Check In'}
              </button>
            </div>
          </div>
        </form>

        {/* Scan Result Visual Display */}
        {scanResult && (
          <div
            className={`p-5 rounded-2xl border backdrop-blur-md animate-fade-in space-y-3 ${
              scanResult.status === 'checked_in' || scanResult.status === 'admitted'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                : scanResult.status === 'already_checked_in' || scanResult.status === 'already_attended'
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {scanResult.status === 'checked_in' || scanResult.status === 'admitted' ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
              ) : scanResult.status === 'already_checked_in' || scanResult.status === 'already_attended' ? (
                <AlertTriangle className="w-7 h-7 text-amber-400 shrink-0" />
              ) : (
                <XCircle className="w-7 h-7 text-rose-400 shrink-0" />
              )}
              <div>
                <h4 className="font-display font-bold text-base capitalize">
                  {scanResult.status.replace(/_/g, ' ')}
                </h4>
                <p className="text-xs opacity-90">{scanResult.message}</p>
              </div>
            </div>

            {scanResult.data?.claims && (
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/60 text-xs font-mono border border-slate-800 text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px]">Pass Number</span>
                  <span>{scanResult.data.claims.passNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Registration</span>
                  <span>{scanResult.data.claims.registrationNumber}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
