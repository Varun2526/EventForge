import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/eventsApi';
import { ticketsApi } from '../api/ticketsApi';
import { sponsorsApi } from '../api/sponsorsApi';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import SessionTimeline from '../components/events/SessionTimeline';
import SpeakerCard from '../components/events/SpeakerCard';
import TicketSelector from '../components/tickets/TicketSelector';
import CheckoutTimer from '../components/tickets/CheckoutTimer';
import confetti from 'canvas-confetti';
import { 
  Calendar, 
  MapPin, 
  Users, 
  CreditCard, 
  ShieldCheck
} from 'lucide-react';

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [event, setEvent] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('tickets');

  // Checkout Hold Modal State
  const [heldRegistration, setHeldRegistration] = useState(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    async function loadEventData() {
      setLoading(true);
      try {
        const [eventData, tiersData, sessionsData, speakersData] = await Promise.all([
          eventsApi.getEvent(id),
          ticketsApi.listTiersByEvent(id).catch(() => ({ tiers: [] })),
          eventsApi.listSessions(id).catch(() => ({ sessions: [] })),
          eventsApi.listSpeakers(id).catch(() => ({ speakers: [] })),
        ]);

        setEvent(eventData.event || eventData);
        setTiers(tiersData.tiers || []);
        setSessions(sessionsData.sessions || []);
        setSpeakers(speakersData.speakers || []);

        try {
          const sponsorData = await sponsorsApi.getEventSponsors(id);
          setSponsors(sponsorData.sponsors || []);
        } catch {
          setSponsors([]);
        }
      } catch (err) {
        error(err.message || 'Failed to load event details.');
      } finally {
        setLoading(false);
      }
    }

    if (id) loadEventData();
  }, [id, error]);

  const handleHoldCreated = (result) => {
    const reg = result.registration || result;
    setHeldRegistration(reg);

    // If free pass, immediately confirmed!
    if (reg.status === 'confirmed' || reg.paymentStatus === 'free') {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      success('Free pass registered successfully! QR badge minted.');
      navigate('/my-tickets');
    } else {
      setIsCheckoutModalOpen(true);
    }
  };

  const handleCompletePayment = async () => {
    if (!heldRegistration) return;
    setProcessingPayment(true);
    try {
      // 1. Create payment intent with payment provider
      const intentResult = await ticketsApi.createPaymentIntent(heldRegistration._id);
      const paymentIntentId = intentResult.paymentIntent?.id;
      if (!paymentIntentId) {
        throw new Error('Payment gateway failed to initialize payment intent.');
      }

      // 2. Verify payment confirmation
      await ticketsApi.verifyPayment({
        registrationId: heldRegistration._id,
        paymentIntentId,
      });

      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      success('Payment successful! Your ticket has been confirmed and QR badge issued.');
      setIsCheckoutModalOpen(false);
      navigate('/my-tickets');
    } catch (err) {
      error(err.message || 'Payment processing failed.');
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading event..." />;
  if (!event) return <div className="text-center py-20 text-slate-400">Event not found.</div>;

  const startDate = new Date(event.startDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Event Header Banner */}
      <div className="glass-card gradient-border p-8 relative overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            {event.status}
          </span>
          <span className="badge bg-brand-500/10 text-brand-300 border border-brand-500/20">
            {event.type}
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-white tracking-tight mb-4">
          {event.title}
        </h1>

        <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed mb-6">
          {event.description}
        </p>

        {/* Quick Details Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-brand-400 shrink-0" />
            <div>
              <span className="text-slate-500 block">Dates</span>
              <span className="font-semibold">{startDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-brand-cyan shrink-0" />
            <div>
              <span className="text-slate-500 block">Venue Location</span>
              <span className="font-semibold">{event.venueRef?.name || 'Convention Arena'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <span className="text-slate-500 block">Capacity</span>
              <span className="font-semibold">{event.registeredCount || 0} / {event.totalCapacity} registered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto custom-scrollbar">
        {[
          { key: 'tickets', label: 'Tickets & Registration' },
          { key: 'agenda', label: `Sessions (${sessions.length})` },
          { key: 'speakers', label: `Speakers (${speakers.length})` },
          { key: 'sponsors', label: `Sponsors (${sponsors.length})` },
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

      {/* Tab Content */}
      <div>
        {activeTab === 'tickets' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-display font-bold text-white mb-1">Select Admission Passes</h3>
              <p className="text-xs text-slate-400">Choose your ticket tier and reserve your spot before sales close.</p>
            </div>
            <TicketSelector
              event={event}
              tiers={tiers}
              onHoldCreated={handleHoldCreated}
            />
          </div>
        )}

        {activeTab === 'agenda' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-display font-bold text-white mb-1">Summit Agenda & Keynotes</h3>
              <p className="text-xs text-slate-400">Chronological schedule across conference rooms.</p>
            </div>
            <SessionTimeline sessions={sessions} />
          </div>
        )}

        {activeTab === 'speakers' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-display font-bold text-white mb-1">Featured Speakers</h3>
              <p className="text-xs text-slate-400">Industry innovators and expert keynote presenters.</p>
            </div>
            {speakers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {speakers.map((sp) => (
                  <SpeakerCard key={sp._id} speaker={sp} />
                ))}
              </div>
            ) : (
              <div className="glass-card p-10 text-center text-slate-400">No speakers assigned yet.</div>
            )}
          </div>
        )}

        {activeTab === 'sponsors' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-display font-bold text-white mb-1">Event Partners & Sponsors</h3>
              <p className="text-xs text-slate-400">Organizations backing innovation at EventForge.</p>
            </div>
            {sponsors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sponsors.map((sp) => (
                  <div key={sp._id} className="glass-card p-6 flex flex-col justify-between">
                    <div>
                      <span className="badge bg-amber-500/10 text-amber-300 border border-amber-500/20 mb-2">
                        {sp.packageTier || 'Sponsor Partner'}
                      </span>
                      <h4 className="text-lg font-bold text-white">{sp.sponsorProfileRef?.name || 'Partner Org'}</h4>
                      <p className="text-xs text-slate-400 mt-1">{sp.sponsorProfileRef?.tagline}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-10 text-center text-slate-400">No confirmed sponsors yet.</div>
            )}
          </div>
        )}
      </div>

      {/* Checkout Hold Modal */}
      <Modal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        title="Complete Checkout Hold"
      >
        {heldRegistration && (
          <div className="space-y-5">
            {/* 15m Countdown Timer */}
            <CheckoutTimer
              expiresAt={heldRegistration.holdExpiresAt}
              onExpired={() => {
                error('Checkout hold expired. The reserved ticket has been returned to available inventory.');
                setIsCheckoutModalOpen(false);
              }}
            />

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Registration Number:</span>
                <span className="font-mono text-white font-semibold">{heldRegistration.registrationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pass Quantity:</span>
                <span className="font-semibold text-white">{heldRegistration.quantity}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 text-sm">
                <span className="text-slate-200 font-medium">Total Amount Due:</span>
                <span className="font-bold font-display text-emerald-400">${heldRegistration.totalAmountPaid || 0}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <span>
                Your ticket inventory is locked in MongoDB transactions. Upon payment, an HMAC-SHA256 badge QR token will be generated instantly.
              </span>
            </div>

            <button
              onClick={handleCompletePayment}
              disabled={processingPayment}
              className="btn-primary w-full py-3 font-semibold text-sm flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              {processingPayment ? 'Confirming Payment...' : `Confirm & Pay $${heldRegistration.totalAmountPaid || 0}`}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
