import React, { useState } from 'react';
import { Ticket, Check, ShoppingCart } from 'lucide-react';
import { ticketsApi } from '../../api/ticketsApi';
import { useToast } from '../../contexts/ToastContext';

export default function TicketSelector({ event, tiers = [], onHoldCreated, onWaitlistJoined }) {
  const [selectedTier, setSelectedTier] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [attendeeDetails, setAttendeeDetails] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  const [loading, setLoading] = useState(false);
  const { success, error, warning } = useToast();

  const handleSelectTier = (tier) => {
    setSelectedTier(tier);
    setQuantity(1);
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const handleValidateCoupon = async () => {
    if (!couponCode.trim() || !selectedTier) return;
    setValidatingCoupon(true);
    try {
      const result = await ticketsApi.validateCoupon({
        code: couponCode.trim(),
        eventId: event._id,
        tierId: selectedTier._id,
      });
      setAppliedCoupon(result);
      success(`Coupon ${result.code} applied! ${result.discountType === 'percentage' ? `${result.discountValue}% off` : `$${result.discountValue} off`}`);
    } catch (err) {
      setAppliedCoupon(null);
      error(err.message || 'Coupon code is invalid or expired.');
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Compute pricing
  const basePrice = selectedTier ? selectedTier.price * quantity : 0;
  let discountAmount = 0;
  if (appliedCoupon && selectedTier) {
    if (appliedCoupon.discountType === 'percentage') {
      discountAmount = (basePrice * appliedCoupon.discountValue) / 100;
    } else {
      discountAmount = Math.min(basePrice, appliedCoupon.discountValue);
    }
  }
  const finalPrice = Math.max(0, Math.round((basePrice - discountAmount) * 100) / 100);

  const handleSubmitHold = async (e) => {
    e.preventDefault();
    if (!selectedTier) {
      warning('Please select a ticket tier first.');
      return;
    }
    if (!attendeeDetails.firstName || !attendeeDetails.lastName || !attendeeDetails.email) {
      warning('Please fill in attendee first name, last name, and email.');
      return;
    }

    setLoading(true);
    try {
      const result = await ticketsApi.holdTicket({
        eventId: event._id,
        ticketTierId: selectedTier._id,
        quantity,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        attendeeDetails,
      });
      success('Ticket reservation held successfully! 15-minute checkout timer started.');
      if (onHoldCreated) onHoldCreated(result);
    } catch (err) {
      error(err.message || 'Failed to hold ticket reservation.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWaitlist = async (tier) => {
    if (!attendeeDetails.firstName || !attendeeDetails.lastName || !attendeeDetails.email) {
      warning('Please fill in your name and email to join the waitlist.');
      return;
    }

    setLoading(true);
    try {
      const result = await ticketsApi.joinWaitlist({
        eventId: event._id,
        ticketTierId: tier._id,
        quantity: 1,
        attendeeDetails,
      });
      success(`You are now on the waitlist at position #${result.waitlistPosition}! You will be promoted if a ticket releases.`);
      if (onWaitlistJoined) onWaitlistJoined(result);
    } catch (err) {
      error(err.message || 'Failed to join waitlist.');
    } finally {
      setLoading(false);
    }
  };

  if (!tiers.length) {
    return (
      <div className="glass-card p-8 text-center text-slate-400">
        <Ticket className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <h4 className="text-base font-semibold text-slate-200">No ticket tiers currently active</h4>
        <p className="text-xs text-slate-500 mt-1">Ticket sales for this event will open shortly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tier Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiers.map((tier) => {
          const available = Math.max(0, tier.totalQuantity - ((tier.soldQuantity || 0) + (tier.reservedQuantity || 0)));
          const isSoldOut = available <= 0;
          const isSelected = selectedTier?._id === tier._id;

          return (
            <div
              key={tier._id}
              onClick={() => !isSoldOut && handleSelectTier(tier)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-brand-500/10 border-brand-500 shadow-glow-brand ring-1 ring-brand-500'
                  : isSoldOut
                  ? 'bg-slate-900/30 border-slate-800 opacity-80 cursor-not-allowed'
                  : 'bg-surface/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-display font-bold text-base text-white">{tier.name}</h4>
                  <span className="text-lg font-bold text-brand-300">
                    {tier.price === 0 ? 'FREE' : `$${tier.price}`}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                  {tier.description || 'Full conference access with keynotes, session tracks, and workshops.'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                <span className={isSoldOut ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                  {isSoldOut ? 'Sold Out' : `${available} tickets remaining`}
                </span>

                {isSoldOut ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoinWaitlist(tier);
                    }}
                    className="btn-outline text-xs py-1 px-2.5 text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
                  >
                    Join Waitlist
                  </button>
                ) : (
                  <span className="text-brand-400 font-semibold flex items-center gap-1">
                    {isSelected ? <Check className="w-4 h-4 text-brand-400" /> : 'Select'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Checkout Form (only if tier selected) */}
      {selectedTier && (
        <form onSubmit={handleSubmitHold} className="glass-card p-6 border-brand-500/30 space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="font-display font-semibold text-white flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-brand-400" />
              Configure Reservation: <span className="text-brand-300">{selectedTier.name}</span>
            </h4>
            <span className="text-xs text-slate-400">15-min hold window</span>
          </div>

          {/* Attendee Info Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">First Name *</label>
              <input
                type="text"
                required
                value={attendeeDetails.firstName}
                onChange={(e) => setAttendeeDetails({ ...attendeeDetails, firstName: e.target.value })}
                placeholder="Jane"
                className="input-field text-sm py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={attendeeDetails.lastName}
                onChange={(e) => setAttendeeDetails({ ...attendeeDetails, lastName: e.target.value })}
                placeholder="Doe"
                className="input-field text-sm py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={attendeeDetails.email}
                onChange={(e) => setAttendeeDetails({ ...attendeeDetails, email: e.target.value })}
                placeholder="jane@example.com"
                className="input-field text-sm py-2"
              />
            </div>
          </div>

          {/* Quantity & Coupon Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end pt-1">
            {/* Quantity */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Quantity (Max {selectedTier.maxPerOrder || 3})
              </label>
              <div className="flex items-center gap-2">
                {[...Array(Math.min(selectedTier.maxPerOrder || 3, 5))].map((_, idx) => {
                  const num = idx + 1;
                  return (
                    <button
                      type="button"
                      key={num}
                      onClick={() => setQuantity(num)}
                      className={`w-10 h-10 rounded-xl text-sm font-semibold border transition-all ${
                        quantity === num
                          ? 'bg-brand-500 text-white border-brand-400 shadow-glow-brand'
                          : 'bg-surface hover:bg-surface-hover text-slate-300 border-slate-800'
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Coupon Code */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Promo / Coupon Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g. VIP25 or FLAT50"
                  className="input-field text-sm py-2 uppercase font-mono"
                />
                <button
                  type="button"
                  onClick={handleValidateCoupon}
                  disabled={validatingCoupon || !couponCode.trim()}
                  className="btn-secondary text-xs px-3 shrink-0"
                >
                  {validatingCoupon ? 'Checking...' : 'Apply'}
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5 text-center sm:text-left">
              <span className="text-xs text-slate-400">Total Calculation</span>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold font-display text-white">
                  ${finalPrice.toFixed(2)}
                </span>
                {discountAmount > 0 && (
                  <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                    Saved ${discountAmount.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full sm:w-auto px-6 py-3 font-semibold text-sm"
            >
              {loading ? 'Reserving...' : selectedTier.price === 0 ? 'Claim Free Pass' : 'Hold Ticket & Proceed (15m)'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
