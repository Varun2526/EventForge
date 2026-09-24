import React, { useState, useEffect } from 'react';
import { eventsApi } from '../api/eventsApi';
import { aiApi } from '../api/aiApi';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { 
  Sparkles, 
  Calendar, 
  Radio
} from 'lucide-react';

export default function OrganizerDashboardPage() {
  const { success, error, warning } = useToast();
  const { user, isOrganizer } = useAuth();

  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab: 'create-event' | 'schedule-session' | 'ai-announcement'
  const [activeTab, setActiveTab] = useState('create-event');

  // 1. Create Event Form with AI Assistant
  const [eventForm, setEventForm] = useState({
    title: '',
    type: 'conference',
    description: '',
    startDate: '',
    endDate: '',
    venueRef: '',
    totalCapacity: 500,
    tags: '',
  });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  // 2. Schedule Session Form with Conflict Detection
  const [selectedEventId, setSelectedEventId] = useState('');
  const [sessionForm, setSessionForm] = useState({
    title: '',
    roomId: '',
    roomName: '',
    startTime: '',
    endTime: '',
    capacityLimit: 100,
    track: 'AI Architecture',
  });
  const [schedulingSession, setSchedulingSession] = useState(false);

  // 3. AI Announcement Form
  const [announcementPrompt, setAnnouncementPrompt] = useState({
    type: 'schedule_update',
    keyMessage: '',
    urgency: 'medium',
  });
  const [generatedAnnouncement, setGeneratedAnnouncement] = useState(null);
  const [generatingAnnouncement, setGeneratingAnnouncement] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [eventsData, venuesData] = await Promise.all([
          eventsApi.listEvents(),
          eventsApi.listVenues().catch(() => ({ venues: [] })),
        ]);

        const evList = eventsData.events || [];
        setEvents(evList);
        if (evList.length > 0) {
          setSelectedEventId(evList[0]._id);
        }

        const vList = venuesData.venues || [];
        setVenues(vList);
        if (vList.length > 0) {
          setEventForm((prev) => ({ ...prev, venueRef: vList[0]._id }));
        }
      } catch (err) {
        console.error('Failed to load organizer data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // AI Copilot for Event Copy
  const handleGenerateEventCopy = async () => {
    if (!aiPrompt.trim()) {
      warning('Please enter a theme or topic for the AI Copilot.');
      return;
    }

    setAiGenerating(true);
    try {
      const result = await aiApi.generateEventCopy({
        topic: aiPrompt,
        eventType: eventForm.type,
        targetAudience: 'Software Architects, Engineering Leaders, and Developers',
        keyPoints: ['Scalability', 'Microservices', 'Event-Driven Architectures'],
      });

      setEventForm((prev) => ({
        ...prev,
        title: result.title || prev.title,
        description: result.description || result.executiveSummary || prev.description,
      }));
      success('AI generated compelling event title and description!');
    } catch (err) {
      error(`AI Generation failed: ${err.message}`);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!user?.organizationRef) {
      warning('Your account is not linked to an organization yet. Ask an admin to add you before creating an event.');
      return;
    }
    try {
      const created = await eventsApi.createEvent({
        ...eventForm,
        organizationRef: user?.organizationRef?._id || user?.organizationRef,
        venueRef: eventForm.venueRef || null,
        tags: eventForm.tags.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean),
        startDate: new Date(eventForm.startDate || Date.now() + 86400000),
        endDate: new Date(eventForm.endDate || Date.now() + 3 * 86400000),
      });
      success(`Event "${created.event?.title || eventForm.title}" draft created successfully!`);
      // Refresh events
      const res = await eventsApi.listEvents();
      setEvents(res.events || []);
      setEventForm((prev) => ({ ...prev, title: '', description: '', tags: '' }));
    } catch (err) {
      error(err.message || 'Failed to create event draft.');
    }
  };

  // Schedule Session with Conflict Validation
  const handleScheduleSession = async (e) => {
    e.preventDefault();
    if (!selectedEventId) {
      warning('Please select an event first.');
      return;
    }

    setSchedulingSession(true);
    try {
      await eventsApi.createSession({
        eventRef: selectedEventId,
        title: sessionForm.title,
        roomId: sessionForm.roomId || '670000000000000000000001',
        roomName: sessionForm.roomName || 'Grand Arena',
        startTime: new Date(sessionForm.startTime || Date.now() + 86400000),
        endTime: new Date(sessionForm.endTime || Date.now() + 86400000 + 3600000),
        capacityLimit: Number(sessionForm.capacityLimit),
        track: sessionForm.track,
      });
      success('Session scheduled successfully with zero room or speaker conflicts!');
    } catch (err) {
      if (err.status === 409 || err.code === 'CONFLICT' || err.code === 'ROOM_CONFLICT') {
        error(`Conflict detected by EventForge Engine: ${err.message}`);
      } else {
        error(err.message || 'Failed to schedule session.');
      }
    } finally {
      setSchedulingSession(false);
    }
  };

  // Generate AI Announcement
  const handleGenerateAnnouncement = async (e) => {
    e.preventDefault();
    if (!selectedEventId || !announcementPrompt.keyMessage) {
      warning('Please select an event and provide the key message.');
      return;
    }

    setGeneratingAnnouncement(true);
    try {
      const result = await aiApi.generateAnnouncement({
        eventId: selectedEventId,
        announcementType: announcementPrompt.type,
        keyMessage: announcementPrompt.keyMessage,
        urgency: announcementPrompt.urgency,
      });
      setGeneratedAnnouncement(result);
      success('AI generated announcement drafts across Email, Push & Slack channels!');
    } catch (err) {
      error(`AI Announcement failed: ${err.message}`);
    } finally {
      setGeneratingAnnouncement(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading Organizer Studio..." />;

  if (!isOrganizer) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="glass-card p-8 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Organizer access required</span>
          <h1 className="font-display text-2xl font-bold text-white">This is the event operations workspace.</h1>
          <p className="text-sm text-slate-400">Sign in with an organizer account to create events, manage schedules, and generate announcements.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">Event Orchestrator Hub</span>
        <h1 className="text-3xl font-display font-bold text-white mt-1">
          Organizer Studio & AI Copilot
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Draft events with AI, schedule multi-track agendas with real-time conflict checking, and broadcast announcements.
        </p>
      </div>

      {/* Studio Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto custom-scrollbar">
        {[
          { key: 'create-event', label: 'Create Event (AI Copilot)' },
          { key: 'schedule-session', label: 'Schedule Sessions & Conflict Engine' },
          { key: 'ai-announcement', label: 'AI Multi-Channel Announcements' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-brand-500 text-white shadow-glow-brand'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Create Event with AI Copilot */}
      {activeTab === 'create-event' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Form: 2 Cols */}
          <div className="lg:col-span-2 glass-card p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-400" />
                Event Details & Settings
              </h3>
              <span className="text-xs text-slate-400">Draft Status</span>
            </div>

            {/* AI Generator Box */}
            <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                  AI Event Drafting Copilot
                </span>
                <span className="text-[10px] text-brand-400/80 uppercase tracking-wider font-mono">OpenAI GPT-4o</span>
              </div>
              <p className="text-xs text-slate-300">
                Type a rough concept, and AI will generate professional titles, descriptions, and tags.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Distributed Cloud & Reactive Microservices Summit 2026"
                  className="input-field text-xs py-2"
                />
                <button
                  type="button"
                  onClick={handleGenerateEventCopy}
                  disabled={aiGenerating}
                  className="btn-primary text-xs px-4 shrink-0"
                >
                  {aiGenerating ? 'Drafting...' : 'Generate with AI'}
                </button>
              </div>
            </div>

            {/* Regular Form Fields */}
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="e.g. Global Tech Concurrency Summit"
                  className="input-field text-sm py-2.5"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Event Type</label>
                  <select
                    value={eventForm.type}
                    onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}
                    className="input-field text-xs py-2.5 bg-slate-900"
                  >
                    <option value="conference">Conference</option>
                    <option value="workshop">Workshop</option>
                    <option value="exhibition">Exhibition</option>
                    <option value="webinar">Webinar</option>
                    <option value="corporate_meet">Corporate meet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Total Venue Capacity *</label>
                  <input
                    type="number"
                    min="10"
                    max="50000"
                    value={eventForm.totalCapacity}
                    onChange={(e) => setEventForm({ ...eventForm, totalCapacity: Number(e.target.value) })}
                    className="input-field text-xs py-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={4}
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="Provide an overview of the event, tracks, and keynote topics..."
                  className="input-field text-xs py-2.5"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Starts *</label>
                  <input
                    type="datetime-local"
                    required
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                    className="input-field text-xs py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Ends *</label>
                  <input
                    type="datetime-local"
                    required
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                    className="input-field text-xs py-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Interest Tags</label>
                <input
                  type="text"
                  value={eventForm.tags}
                  onChange={(e) => setEventForm({ ...eventForm, tags: e.target.value })}
                  placeholder="e.g. AI, cloud, leadership"
                  className="input-field text-xs py-2.5"
                />
                <p className="mt-1 text-[11px] text-slate-500">Comma-separated topics power event discovery and recommendations.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Venue</label>
                <select
                  value={eventForm.venueRef}
                  onChange={(e) => setEventForm({ ...eventForm, venueRef: e.target.value })}
                  className="input-field text-xs py-2.5 bg-slate-900"
                >
                  {venues.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.name} ({v.capacity} max capacity)
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn-primary w-full py-3 font-semibold text-sm">
                Save & Create Event Draft
              </button>
            </form>
          </div>

          {/* Right Sidebar: Active Events Roster */}
          <div className="space-y-4">
            <h3 className="font-display font-bold text-white text-base">Your Organized Events ({events.length})</h3>
            <div className="space-y-3">
              {events.map((ev) => (
                <div key={ev._id} className="p-4 rounded-xl glass-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white line-clamp-1">{ev.title}</span>
                    <span className="badge text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {ev.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{ev.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Schedule Session & Conflict Detection */}
      {activeTab === 'schedule-session' && (
        <div className="glass-card p-6 md:p-8 space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-lg font-display font-bold text-white">Session Scheduler</h3>
              <p className="text-xs text-slate-400">Integrated with EventForge Conflict Detection Engine.</p>
            </div>
            <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded border border-purple-500/20">
              Zero Conflict Engine
            </span>
          </div>

          <form onSubmit={handleScheduleSession} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Event *</label>
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">Session Title *</label>
              <input
                type="text"
                required
                value={sessionForm.title}
                onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                placeholder="e.g. Distributed Tracing & High-Throughput Pipelines"
                className="input-field text-sm py-2"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Room Name</label>
                <input
                  type="text"
                  value={sessionForm.roomName}
                  onChange={(e) => setSessionForm({ ...sessionForm, roomName: e.target.value })}
                  placeholder="e.g. Grand Arena"
                  className="input-field text-xs py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Room Capacity Limit</label>
                <input
                  type="number"
                  min="5"
                  max="1000"
                  value={sessionForm.capacityLimit}
                  onChange={(e) => setSessionForm({ ...sessionForm, capacityLimit: e.target.value })}
                  className="input-field text-xs py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={sessionForm.startTime}
                  onChange={(e) => setSessionForm({ ...sessionForm, startTime: e.target.value })}
                  className="input-field text-xs py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={sessionForm.endTime}
                  onChange={(e) => setSessionForm({ ...sessionForm, endTime: e.target.value })}
                  className="input-field text-xs py-2"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={schedulingSession}
              className="btn-primary w-full py-3 font-semibold text-sm"
            >
              {schedulingSession ? 'Validating Conflicts...' : 'Validate Schedule & Create Session'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: AI Multi-Channel Announcement Generator */}
      {activeTab === 'ai-announcement' && (
        <div className="glass-card p-6 md:p-8 space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-brand-400" />
                AI Announcement Broadcaster
              </h3>
              <p className="text-xs text-slate-400">Generate multi-channel updates with structured urgent messaging.</p>
            </div>
          </div>

          <form onSubmit={handleGenerateAnnouncement} className="space-y-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Announcement Type</label>
                <select
                  value={announcementPrompt.type}
                  onChange={(e) => setAnnouncementPrompt({ ...announcementPrompt, type: e.target.value })}
                  className="input-field text-xs py-2 bg-slate-900"
                >
                  <option value="schedule_update">Schedule Update</option>
                  <option value="room_change">Room Change</option>
                  <option value="general">General Update</option>
                  <option value="sponsor_spotlight">Sponsor Spotlight</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Urgency Level</label>
                <select
                  value={announcementPrompt.urgency}
                  onChange={(e) => setAnnouncementPrompt({ ...announcementPrompt, urgency: e.target.value })}
                  className="input-field text-xs py-2 bg-slate-900"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Key Message Notes *</label>
              <textarea
                rows={3}
                required
                value={announcementPrompt.keyMessage}
                onChange={(e) => setAnnouncementPrompt({ ...announcementPrompt, keyMessage: e.target.value })}
                placeholder="e.g. Dr. Alice Henderson's keynote on NeuroTech will now start at 11:30 AM in Grand Arena."
                className="input-field text-xs py-2"
              />
            </div>

            <button
              type="submit"
              disabled={generatingAnnouncement}
              className="btn-primary w-full py-3 font-semibold text-sm"
            >
              {generatingAnnouncement ? 'Generating Announcements...' : 'Generate Multi-Channel Copy'}
            </button>
          </form>

          {/* Generated Result */}
          {generatedAnnouncement && (
            <div className="space-y-4 pt-4 border-t border-slate-800 animate-fade-in">
              <h4 className="font-display font-semibold text-white text-sm">Generated Channel Formats</h4>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-semibold text-brand-300 uppercase tracking-wider block">Email Subject</span>
                <p className="text-xs text-white font-medium">{generatedAnnouncement.emailSubject || generatedAnnouncement.title}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider block">Push Notification (Mobile)</span>
                <p className="text-xs text-slate-200">{generatedAnnouncement.pushNotification || generatedAnnouncement.shortMessage}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block">Full Broadcast Body</span>
                <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{generatedAnnouncement.broadcastMessage || generatedAnnouncement.content}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
