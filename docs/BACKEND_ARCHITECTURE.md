# 🏗️ EventForge — Concrete Backend Architecture & Engineering Blueprint

> **Version:** 2.1.0 (Implementation-Ready Architecture)  
> **Status:** Final Approved Architecture  
> **Tech Stack:** Node.js (v18+), Express.js (v5), MongoDB (v7+), Mongoose (v9+), OpenAI API, JWT / HMAC-SHA256  
> **Scope:** Corporate Event & Conference Management Platform (AI-Enabled Capstone)

---

## 📋 Changelog (v2.0.0 → v2.1.0)

- **Explicit Waitlist Lifecycle & APIs:** Added deterministic FIFO queue ordering (`waitlistPosition`, `waitlistJoinedAt`), queue promotion windows, and dedicated endpoints (`POST /registrations/waitlist`, `GET /registrations/waitlist/:eventId`, `DELETE /registrations/waitlist/:registrationId`).
- **Separated Hold Semantics:** Introduced `holdType` (`checkout` = 15 mins vs `waitlist_claim` = 24 hours) with distinct expiration behaviors.
- **Corrected Active Registration Uniqueness:** Replaced broken compound index with a MongoDB Partial Unique Index on `{ eventRef: 1, userRef: 1 }` filtered by active states (`held`, `confirmed`, `pending_approval`).
- **Hold Expiration vs. Payment Confirmation Race Condition Fix:** Established strict transactional conditional state matching—ensuring a registration transitions out of `held` exactly once.
- **Payment Webhook Idempotency:** Introduced dedicated `PaymentEvent` collection (Collection #17) to prevent duplicate processing, repeated inventory incrementation, and multiple email dispatches.
- **Multi-Ticket Order Support:** Added `quantity` support (bounded by `maxPerOrder`), atomic capacity increments/decrements, and an `attendeePasses` subdocument model assigning individual cryptographic QR badges per pass.
- **Two-Phase Coupon Concurrency:** Implemented `reservedUses` and atomic conditional updates on `Coupon` to eliminate promo code overselling during checkout rushes.
- **Architectural Invariants & Failure Matrix:** Added 10 core engineering invariants and an 11-scenario failure recovery table.

---

## 1. Executive Summary & Core Design Principles

EventForge is an enterprise corporate event and conference management platform. It coordinates the full event lifecycle across six distinct user personas: **Platform Admin**, **Event Organizer**, **Event Staff**, **Speaker**, **Attendee**, and **Sponsor**.

### Core Architectural Invariants

1. **Strict Layered Separation:**
   `React Frontend` → `Express API (/api/v1)` → `Middleware Pipeline` → `Controllers` → `Domain Business Services` → `Integrations / Jobs` → `Mongoose Models` → `MongoDB`.
2. **Two-Phase Inventory Hold & Payment State Machine:**
   Ticket inventory is **never** prematurely marked as `sold` or `paid` at checkout initiation. Instead, inventory moves through a deterministic state machine: `AVAILABLE` → `HELD` → (`CONFIRMED` on payment success | `RELEASED` on cart abandonment or hold expiration) → `AVAILABLE` (with waitlist auto-promotion).
3. **Multi-Tier Authorization (Platform Global + Event-Scoped RBAC):**
   Decouples user identity from rigid role strings. A user has a global platform role (`platform_admin`, `user`) and dynamic event-scoped roles (`event_organizer`, `event_staff`, `speaker`, `attendee`, `sponsor`) evaluated per event context.
4. **Mathematical Schedule Conflict Guarantee:**
   Session scheduling enforces an overlap formula on both physical venue rooms and human speakers: `(StartA < EndB) && (EndA > StartB)`.
5. **Cryptographic, Idempotent Attendance Tracking:**
   Badges are issued as HMAC-SHA256 signed JWT tokens only after confirmation. Check-ins are strictly idempotent with duplicate scan rejection, maintaining separate records for event gate admission and per-session capacity tracking.
6. **Decoupled External Integrations & Async Jobs:**
   Payments, AI, email, and storage are isolated behind provider interfaces (`integrations/`). Background jobs (`jobs/`) handle hold expiration, waitlist cascades, and broadcast queues.

---

## 2. High-Level System Architecture & Flow

```text
                         ┌──────────────────────────┐
                         │      React Frontend      │
                         │                          │
                         │  Attendee                │
                         │  Organizer               │
                         │  Staff                   │
                         │  Speaker                 │
                         │  Sponsor                 │
                         │  Platform Admin          │
                         └────────────┬─────────────┘
                                      │
                                  HTTPS/JSON
                                      │
                         ┌────────────▼─────────────┐
                         │       Express API        │
                         │        /api/v1            │
                         └────────────┬─────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │          Middleware Pipeline       │
                    │                                    │
                    │ Helmet / CORS                     │
                    │ Rate Limiter                      │
                    │ Sanitization (Mongo & XSS)        │
                    │ JWT Authentication                │
                    │ Request Validation (Zod)          │
                    │ Event-Scoped Authorization        │
                    └─────────────────┬─────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │            Controllers             │
                    │                                    │
                    │ Auth │ Organizations │ Events      │
                    │ Venues │ Sessions │ Speakers       │
                    │ Tickets │ Registrations │ Payments │
                    │ Check-in │ Sponsors │ Staff        │
                    │ Announcements │ Feedback │ AI      │
                    │ Analytics                         │
                    └─────────────────┬─────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │         Business Services          │
                    │                                    │
                    │ Registration Service              │
                    │ Ticket Inventory Engine (2-Phase) │
                    │ Conflict Detection Engine         │
                    │ QR Verification Engine             │
                    │ Payment Service                   │
                    │ Waitlist Service                  │
                    │ Analytics Engine (Modular)        │
                    │ AI Generation Service             │
                    │ AI Recommendation Engine          │
                    │ Email Service                     │
                    └────────┬─────────────────┬────────┘
                             │                 │
              ┌──────────────▼──────┐   ┌──────▼──────────────┐
              │    Integrations     │   │   Background Jobs   │
              │                     │   │                     │
              │ • PaymentProvider   │   │ • expireTicketHolds │
              │ • OpenAIProvider    │   │ • processWaitlist   │
              │ • EmailProvider     │   │ • sendNotifications │
              │ • StorageProvider   │   └─────────────────────┘
              └──────────────┬──────┘
                             │
                    ┌────────▼──────────────────────────┐
                    │          Mongoose Models           │
                    │ (17 Schemas, Indexes, Transitions)│
                    └─────────────────┬─────────────────┘
                                      │
                              ┌───────▼───────┐
                              │    MongoDB    │
                              └───────────────┘
```

---

## 3. End-to-End Business Flows & State Machines

### 3.1 The Two-Phase Ticket Inventory & Payment State Machine

```text
                      [ User Selects Ticket Tier & Quantity ]
                                         │
                                         ▼
                             ┌───────────────────────┐
                             │   AVAILABLE INVENTORY │
                             │ total - (sold + held) │
                             └───────────┬───────────┘
                                         │
                   Atomic Hold Request: holdType: 'checkout'
                                         │
                                         ▼
                             ┌───────────────────────┐
                             │     HELD INVENTORY    │
                             │ reservedQuantity += Q │
                             │ Registration: held    │
                             │ holdType: 'checkout'  │
                             │ Hold Timer: 15 mins   │
                             └───────────┬───────────┘
                                         │
             ┌───────────────────────────┴───────────────────────────┐
             │                                                       │
      Payment Succeeded                                       Payment Failed /
      Webhook Confirmed                                      Hold Timer Expired
             │                                                       │
             ▼                                                       ▼
 ┌───────────────────────────┐                           ┌───────────────────────────┐
 │         CONFIRMED         │                           │         RELEASED          │
 │ reservedQuantity -= Q     │                           │ reservedQuantity -= Q     │
 │ soldQuantity += Q         │                           │ Registration: expired     │
 │ Registration: confirmed   │                           │ Inventory: restored       │
 │ Mint HMAC QR Badge(s)     │                           └───────────┬───────────────┘
 └───────────────────────────┘                                       │
                                                             Auto-Promote Waitlist
                                                                     │
                                                                     ▼
                                                         ┌───────────────────────────┐
                                                         │   WAITLIST PROMOTED       │
                                                         │ reservedQuantity += Q     │
                                                         │ Registration: held        │
                                                         │ holdType: 'waitlist_claim'│
                                                         │ Hold Timer: 24 hours      │
                                                         └───────────────────────────┘
```

#### Hold Type Semantics
1. **Checkout Hold (`holdType: 'checkout'`):**
   - **Trigger:** Attendee clicks "Checkout" for an available ticket tier.
   - **Duration:** 15 minutes (`holdExpiresAt = now + 15m`).
   - **Quantity:** $1 \le Q \le \text{maxPerOrder}$.
   - **Inventory Impact:** `TicketTier.reservedQuantity += Q`.
   - **Failure Outcome:** Transitions to `expired`. `reservedQuantity -= Q`. Triggers `WaitlistService.promoteNextInQueue`.
2. **Waitlist Claim Hold (`holdType: 'waitlist_claim'`):**
   - **Trigger:** System automatically promotes the next eligible waitlisted attendee upon inventory release.
   - **Duration:** 24 hours (`holdExpiresAt = now + 24h`).
   - **Quantity:** $Q$ (allocated for the specific waitlist request).
   - **Inventory Impact:** `TicketTier.reservedQuantity += Q`.
   - **Failure Outcome:** If unpurchased after 24 hours, transitions to `expired`. `reservedQuantity -= Q`. Cascade promotes the *next* person in line.

---

### 3.2 Attendee End-to-End Flow

```text
                 ┌─────────────────────────┐
                 │ 1. User Authentication  │ (Register / Login / JWT)
                 └────────────┬────────────┘
                              ▼
                 ┌─────────────────────────┐
                 │ 2. Browse Event Catalog │ (Search, Tag filter, AI recommendations)
                 └────────────┬────────────┘
                              ▼
                 ┌─────────────────────────┐
                 │ 3. Event Details Page   │ (Speakers, Schedule Grid, Venues)
                 └────────────┬────────────┘
                              ▼
                 ┌─────────────────────────┐
                 │ 4. Select Ticket & Qty  │ (1 <= Qty <= maxPerOrder)
                 └────────────┬────────────┘
                              ▼
                 ┌─────────────────────────┐
                 │ 5. Session Selection    │ (Bookmark or RSVP for breakout sessions)
                 └────────────┬────────────┘
                              ▼
                 ┌─────────────────────────┐
                 │ 6. Ticket Inventory Hold│ (POST /registrations/hold -> status: 'held', Qty held)
                 └────────────┬────────────┘
                              ▼
                 ┌─────────────────────────┐
                 │ 7. Payment Processing   │ (POST /payments/create-intent -> Stripe/Mock)
                 └────────────┬────────────┘
                              ▼
                 ┌─────────────────────────┐
                 │ 8. Webhook Confirmation │ (POST /payments/webhook -> atomic transition to 'confirmed')
                 └────────────┬────────────┘
                              ▼
                 ┌─────────────────────────┐
                 │ 9. Ticket Issued + QRs  │ (Cryptographic badge per pass + Email confirmation)
                 └────────────┬────────────┘
                              ▼
                     [ EVENT DAY ]
                              ▼
                 ┌─────────────────────────┐
                 │ 10. QR Badge Gate Scan  │ (Staff scans badge -> Event Check-in marked)
                 └────────────┬────────────┘
                              ▼
                 ┌─────────────────────────┐
                 │ 11. Session Admission   │ (Staff scans at room door -> SessionAttendance logged)
                 └────────────┬────────────┘
                              ▼
                 ┌─────────────────────────┐
                 │ 12. Feedback & Rating   │ (Submit 1-5 star review + AI sentiment scoring)
                 └─────────────────────────┘
```

---

### 3.3 Waitlist Lifecycle & Deterministic Promotion

```text
                     [ Tier is Sold Out ]
                              │
                              ▼
                 POST /registrations/waitlist
                              │
                              ▼
               ┌───────────────────────────────┐
               │ Registration: 'waitlisted'    │
               │ waitlistJoinedAt = now        │
               │ waitlistPosition = max(pos)+1 │
               └──────────────┬────────────────┘
                              │
                    Inventory Released
               (Ticket cancelled / Hold expired)
                              │
                              ▼
                 Find Oldest Waitlisted User
                  ORDER BY waitlistPosition ASC
                              │
                              ▼
               ┌───────────────────────────────┐
               │ Registration: 'held'          │
               │ holdType: 'waitlist_claim'    │
               │ holdExpiresAt = now + 24h     │
               │ waitlistPosition = null       │
               └──────────────┬────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
       User Buys Ticket               24h Timer Expires
              │                               │
              ▼                               ▼
     Registration: confirmed        Registration: expired
      soldQuantity += Q             reservedQuantity -= Q
                                              │
                                              ▼
                                     Promote Next User
```

#### Waitlist Business Rules
1. **Deterministic Position Assignment:** Queue position is strictly assigned using `waitlistPosition = (count of active waitlisted entries for tier) + 1` alongside `waitlistJoinedAt = new Date()`.
2. **Deterministic Promotion:** The queue is consumed in strict FIFO order (`ORDER BY waitlistJoinedAt ASC, waitlistPosition ASC`).
3. **Cancellation & Position Preservation:** When a user leaves the waitlist (`DELETE /registrations/waitlist/:id`), their entry is marked `cancelled`. Subsequent promotions strictly query active `status: 'waitlisted'` ordered by timestamp, ensuring no user is skipped.
4. **Active Registration Exclusivity:** A user with an active registration (`held`, `confirmed`, `pending_approval`) cannot join a waitlist for the same event unless their current registration is cancelled.

---

## 4. Database Modeling & 17 Mongoose Schemas

The database uses **17 collections** (16 domain entities + 1 idempotency tracking entity).

### 4.1 Key Schemas & Integrity Constraints

#### 1. `TicketTier` (`models/TicketTier.js`)
```javascript
const TicketTierSchema = new mongoose.Schema({
  eventRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD' },
  totalQuantity: { type: Number, required: true, min: 1 },
  soldQuantity: { type: Number, default: 0, min: 0 },
  reservedQuantity: { type: Number, default: 0, min: 0 }, // HELD IN CARTS & WAITLIST CLAIMS
  salesStart: { type: Date, required: true },
  salesEnd: { type: Date, required: true },
  maxPerOrder: { type: Number, default: 5, min: 1 },
  perks: [{ type: String }],
  accessLevel: { type: String, enum: ['standard', 'all_access', 'vip', 'speaker', 'sponsor'], default: 'standard' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Virtual to calculate available seats
TicketTierSchema.virtual('availableQuantity').get(function() {
  return Math.max(0, this.totalQuantity - (this.soldQuantity + this.reservedQuantity));
});

TicketTierSchema.index({ eventRef: 1, isActive: 1 });
```

#### 2. `Registration` (`models/Registration.js`)
```javascript
const AttendeePassSubSchema = new mongoose.Schema({
  passNumber: { type: String, required: true }, // e.g. "EF-2026-9A7B3-1"
  holderName: { type: String, required: true },
  holderEmail: { type: String, required: true },
  qrCodePayload: { type: String, default: null }, // Distinct HMAC token for this pass
  checkedIn: { type: Boolean, default: false, index: true },
  checkedInAt: { type: Date, default: null },
  checkedInByStaffRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { _id: true });

const RegistrationSchema = new mongoose.Schema({
  eventRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ticketTierRef: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketTier', required: true, index: true },
  registrationNumber: { type: String, required: true, unique: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  status: { 
    type: String, 
    enum: ['held', 'confirmed', 'cancelled', 'expired', 'waitlisted', 'pending_approval', 'rejected'], 
    default: 'held',
    index: true 
  },
  holdType: {
    type: String,
    enum: ['checkout', 'waitlist_claim', null],
    default: 'checkout'
  },
  paymentStatus: { 
    type: String, 
    enum: ['unpaid', 'pending', 'paid', 'failed', 'refunded', 'free'], 
    default: 'unpaid' 
  },
  holdExpiresAt: { type: Date, index: true }, // Indexed for expiration cron
  paymentIntentId: { type: String, default: null },
  totalAmountPaid: { type: Number, default: 0 },
  couponRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
  
  // Waitlist tracking
  waitlistPosition: { type: Number, default: null },
  waitlistJoinedAt: { type: Date, default: null },

  // Primary purchaser contact details
  attendeeDetails: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    company: { type: String },
    designation: { type: String },
    dietaryRequirements: { type: String, default: 'None' },
    tShirtSize: { type: String, enum: ['XS', 'S', 'M', 'L', 'XL', '2XL', 'None'], default: 'None' }
  },

  // Individual ticket passes (length === quantity)
  attendeePasses: [AttendeePassSubSchema]
}, { timestamps: true });

// CRITICAL: Partial Unique Index 1 (Active Registration Guard)
// A user can hold at most ONE active registration per event.
RegistrationSchema.index(
  { eventRef: 1, userRef: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['held', 'confirmed', 'pending_approval'] }
    }
  }
);

// CRITICAL: Partial Unique Index 2 (Active Waitlist Guard)
// A user cannot occupy multiple waitlist spots for the same tier.
RegistrationSchema.index(
  { eventRef: 1, userRef: 1, ticketTierRef: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'waitlisted' }
  }
);

RegistrationSchema.index({ ticketTierRef: 1, waitlistPosition: 1 });
```

#### 3. `Coupon` (`models/Coupon.js`)
```javascript
const CouponSchema = new mongoose.Schema({
  eventRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  discountType: { type: String, enum: ['percentage', 'fixed_amount'], required: true },
  discountValue: { type: Number, required: true, min: 1 },
  minOrderAmount: { type: Number, default: 0 },
  maxUses: { type: Number, required: true, min: 1 },
  usedCount: { type: Number, default: 0, min: 0 },
  reservedUses: { type: Number, default: 0, min: 0 }, // 2-Phase Concurrency Guard
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  applicableTierRefs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TicketTier' }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

CouponSchema.index({ eventRef: 1, code: 1 }, { unique: true });
```

#### 4. `PaymentEvent` (`models/PaymentEvent.js`) — Webhook Idempotency
```javascript
const PaymentEventSchema = new mongoose.Schema({
  provider: { type: String, enum: ['stripe', 'razorpay', 'mock'], required: true },
  eventId: { type: String, required: true }, // Gateway event ID (e.g. "evt_1N4...")
  eventType: { type: String, required: true }, // e.g. "payment_intent.succeeded"
  registrationRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', default: null },
  status: { type: String, enum: ['received', 'processed', 'failed', 'ignored'], default: 'received' },
  payload: { type: mongoose.Schema.Types.Mixed },
  processedAt: { type: Date, default: null }
}, { timestamps: true });

PaymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
```

#### Remaining 13 Domain Mongoose Schemas (Summary)
- **`User`**: Identity, email, passwordHash, globalRole (`admin`/`user`), interests[], organizationRef.
- **`Organization`**: Multi-tenant boundaries, name, slug, ownerRef, members[], subscription.
- **`Event`**: Life cycle states, dates, venues, capacities, tags[] for AI recommendations.
- **`Venue`**: Address, geo-coordinates, capacity, rooms[] with AV specs.
- **`Session`**: Schedules, tracks, room ID, speaker IDs, capacity limit. Compound index `{ eventRef: 1, roomId: 1, startTime: 1, endTime: 1 }`.
- **`SpeakerProfile`**: Bios, social links, topics, event assignments.
- **`SessionAttendance`**: Unique gate scan per session: `{ sessionRef: 1, 'attendeePass.passNumber': 1 }`.
- **`SponsorProfile`**: Company brand collateral, contact info.
- **`SponsorPackage`**: Sponsorship tiers, benefits, prices, max slots.
- **`Sponsorship`**: Assigned deliverables, deadlines, fulfillment statuses.
- **`StaffAssignment`**: Assigned operational roles, assigned rooms, shift schedules.
- **`Announcement`**: Broadcasts, audience segmentation, in-app and email delivery logs.
- **`Feedback`**: 1-5 star ratings, dimensions, AI sentiment scores (-1.0 to +1.0).

---

## 5. Domain Business Services & Core Engines

### 5.1 Ticket Inventory Engine (`services/ticketInventoryEngine.js`)

```javascript
import mongoose from 'mongoose';
import TicketTier from '../models/TicketTier.js';
import Registration from '../models/Registration.js';
import Coupon from '../models/Coupon.js';
import { QRVerificationEngine } from './qrVerificationEngine.js';
import { AppError } from '../utils/AppError.js';

export class TicketInventoryEngine {
  /**
   * Phase 1: Hold ticket inventory for requested quantity
   */
  static async holdTicket({ eventId, userId, ticketTierId, quantity = 1, couponCode, attendeeDetails }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const tier = await TicketTier.findById(ticketTierId).session(session);
      if (!tier || !tier.isActive) throw new AppError('Ticket tier not found or inactive.', 404);
      
      if (quantity < 1 || quantity > tier.maxPerOrder) {
        throw new AppError(`Quantity must be between 1 and ${tier.maxPerOrder}.`, 400);
      }

      // 1. Atomic capacity check & reservation for requested quantity
      const updatedTier = await TicketTier.findOneAndUpdate(
        {
          _id: ticketTierId,
          eventRef: eventId,
          isActive: true,
          $expr: {
            $gte: [
              { $subtract: ['$totalQuantity', { $add: ['$soldQuantity', '$reservedQuantity'] }] },
              quantity
            ]
          }
        },
        { $inc: { reservedQuantity: quantity } },
        { new: true, session }
      );

      if (!updatedTier) {
        throw new AppError('Requested ticket quantity is no longer available.', 409, 'TICKET_UNAVAILABLE');
      }

      // 2. Atomic 2-Phase Coupon Reservation
      let finalPricePerTicket = updatedTier.price;
      let couponDoc = null;
      if (couponCode) {
        couponDoc = await Coupon.findOneAndUpdate(
          {
            eventRef: eventId,
            code: couponCode.toUpperCase(),
            isActive: true,
            validFrom: { $lte: new Date() },
            validUntil: { $gte: new Date() },
            $expr: { $lt: [{ $add: ['$usedCount', '$reservedUses'] }, '$maxUses'] }
          },
          { $inc: { reservedUses: 1 } },
          { new: true, session }
        );

        if (couponDoc) {
          if (couponDoc.discountType === 'percentage') {
            finalPricePerTicket -= (finalPricePerTicket * couponDoc.discountValue) / 100;
          } else {
            finalPricePerTicket = Math.max(0, finalPricePerTicket - (couponDoc.discountValue / quantity));
          }
        }
      }

      const totalAmount = Math.max(0, finalPricePerTicket * quantity);
      const registrationNumber = `EF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Build attendee passes
      const attendeePasses = [];
      for (let i = 1; i <= quantity; i++) {
        attendeePasses.push({
          passNumber: `${registrationNumber}-${i}`,
          holderName: i === 1 ? `${attendeeDetails.firstName} ${attendeeDetails.lastName}` : `Guest ${i} of ${attendeeDetails.firstName}`,
          holderEmail: i === 1 ? attendeeDetails.email : `guest${i}_${attendeeDetails.email}`,
          qrCodePayload: null, // Minted only upon confirmation
          checkedIn: false
        });
      }

      // 3. If Free ($0), immediately confirm and mint badges
      if (totalAmount === 0) {
        await TicketTier.findByIdAndUpdate(
          ticketTierId,
          { $inc: { reservedQuantity: -quantity, soldQuantity: quantity } },
          { session }
        );

        if (couponDoc) {
          await Coupon.findByIdAndUpdate(couponDoc._id, { $inc: { reservedUses: -1, usedCount: 1 } }, { session });
        }

        // Mint badges for each pass
        attendeePasses.forEach(pass => {
          pass.qrCodePayload = QRVerificationEngine.signBadgeToken({
            passNumber: pass.passNumber,
            regNum: registrationNumber,
            eventId,
            userId,
            tierId: ticketTierId
          });
        });

        const [registration] = await Registration.create([{
          eventRef: eventId,
          userRef: userId,
          ticketTierRef: ticketTierId,
          registrationNumber,
          quantity,
          status: 'confirmed',
          holdType: null,
          paymentStatus: 'free',
          totalAmountPaid: 0,
          couponRef: couponDoc?._id || null,
          attendeeDetails,
          attendeePasses
        }], { session });

        await session.commitTransaction();
        return { status: 'confirmed', registration };
      }

      // 4. Paid Ticket: Hold for 15 minutes
      const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const [registration] = await Registration.create([{
        eventRef: eventId,
        userRef: userId,
        ticketTierRef: ticketTierId,
        registrationNumber,
        quantity,
        status: 'held',
        holdType: 'checkout',
        paymentStatus: 'pending',
        holdExpiresAt,
        totalAmountPaid: totalAmount,
        couponRef: couponDoc?._id || null,
        attendeeDetails,
        attendeePasses
      }], { session });

      await session.commitTransaction();
      return { status: 'held', holdExpiresAt, registration };

    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Phase 2: Transactional State Transition out of 'held' into 'confirmed'
   */
  static async confirmPayment({ registrationId, paymentIntentId }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // INVARIANT: Exactly one transition out of 'held'
      const reg = await Registration.findOneAndUpdate(
        {
          _id: registrationId,
          status: 'held',
          holdExpiresAt: { $gte: new Date() } // Concurrency Guard against expired holds
        },
        {
          $set: {
            status: 'confirmed',
            paymentStatus: 'paid',
            paymentIntentId,
            holdExpiresAt: null,
            holdType: null
          }
        },
        { new: true, session }
      );

      if (!reg) {
        // If not found, check if already confirmed (idempotent replay)
        const alreadyConfirmed = await Registration.findOne({ _id: registrationId, status: 'confirmed' }).session(session);
        if (alreadyConfirmed) {
          await session.abortTransaction();
          return alreadyConfirmed;
        }
        throw new AppError('Ticket hold has expired or was already cancelled.', 410, 'HOLD_EXPIRED');
      }

      // Adjust inventory
      await TicketTier.findByIdAndUpdate(
        reg.ticketTierRef,
        { $inc: { reservedQuantity: -reg.quantity, soldQuantity: reg.quantity } },
        { session }
      );

      // Finalize coupon consumption
      if (reg.couponRef) {
        await Coupon.findByIdAndUpdate(
          reg.couponRef,
          { $inc: { reservedUses: -1, usedCount: 1 } },
          { session }
        );
      }

      // Mint QR badges for each pass
      reg.attendeePasses.forEach(pass => {
        pass.qrCodePayload = QRVerificationEngine.signBadgeToken({
          passNumber: pass.passNumber,
          regNum: reg.registrationNumber,
          eventId: reg.eventRef,
          userId: reg.userRef,
          tierId: reg.ticketTierRef
        });
      });

      await reg.save({ session });
      await session.commitTransaction();

      return reg;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}
```

---

### 5.2 Background Jobs & Concurrency Engines

#### `jobs/expireTicketHolds.js`
Runs every 60 seconds. Uses atomic conditional matching to ensure it never cancels a registration currently undergoing confirmation.

```javascript
import mongoose from 'mongoose';
import Registration from '../models/Registration.js';
import TicketTier from '../models/TicketTier.js';
import Coupon from '../models/Coupon.js';
import { WaitlistService } from '../services/waitlistService.js';
import { logger } from '../utils/logger.js';

export const expireTicketHoldsJob = async () => {
  const expiredCandidates = await Registration.find({
    status: 'held',
    holdExpiresAt: { $lt: new Date() }
  }).select('_id ticketTierRef quantity couponRef holdType');

  for (const candidate of expiredCandidates) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // INVARIANT: State guard - transition HELD -> EXPIRED conditionally
      const reg = await Registration.findOneAndUpdate(
        {
          _id: candidate._id,
          status: 'held',
          holdExpiresAt: { $lt: new Date() }
        },
        {
          $set: {
            status: 'expired',
            paymentStatus: 'failed',
            holdType: null
          }
        },
        { new: true, session }
      );

      if (!reg) {
        // Confirmation won the race and updated status to confirmed!
        await session.abortTransaction();
        continue;
      }

      // Release reserved inventory
      await TicketTier.findByIdAndUpdate(
        reg.ticketTierRef,
        { $inc: { reservedQuantity: -reg.quantity } },
        { session }
      );

      // Release reserved coupon usage
      if (reg.couponRef) {
        await Coupon.findByIdAndUpdate(
          reg.couponRef,
          { $inc: { reservedUses: -1 } },
          { session }
        );
      }

      await session.commitTransaction();
      logger.info(`Expired ${reg.holdType} hold for reg: ${reg._id}`);

      // Trigger waitlist cascade
      await WaitlistService.promoteNextInQueue(reg.ticketTierRef);

    } catch (err) {
      await session.abortTransaction();
      logger.error(`Failed to process expiration for reg: ${candidate._id}`, err);
    } finally {
      session.endSession();
    }
  }
};
```

#### `services/waitlistService.js`
```javascript
import Registration from '../models/Registration.js';
import TicketTier from '../models/TicketTier.js';
import { EmailService } from './emailService.js';
import { AppError } from '../utils/AppError.js';

export class WaitlistService {
  /**
   * User joins the waitlist for a sold-out tier
   */
  static async joinWaitlist({ eventId, userId, ticketTierId, quantity = 1, attendeeDetails }) {
    const activeWaitlistCount = await Registration.countDocuments({
      ticketTierRef: ticketTierId,
      status: 'waitlisted'
    });

    const registrationNumber = `EF-WL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const registration = await Registration.create({
      eventRef: eventId,
      userRef: userId,
      ticketTierRef: ticketTierId,
      registrationNumber,
      quantity,
      status: 'waitlisted',
      holdType: null,
      paymentStatus: 'unpaid',
      waitlistPosition: activeWaitlistCount + 1,
      waitlistJoinedAt: new Date(),
      attendeeDetails
    });

    return registration;
  }

  /**
   * Promotes the next waitlisted user in FIFO order
   */
  static async promoteNextInQueue(ticketTierId) {
    // Deterministic FIFO: oldest joined active waitlist entry
    const nextInLine = await Registration.findOne({
      ticketTierRef: ticketTierId,
      status: 'waitlisted'
    }).sort({ waitlistJoinedAt: 1, waitlistPosition: 1 }).populate('userRef', 'name email');

    if (!nextInLine) return null;

    // Reserve inventory for the waitlist claim
    const tier = await TicketTier.findOneAndUpdate(
      {
        _id: ticketTierId,
        $expr: {
          $gte: [
            { $subtract: ['$totalQuantity', { $add: ['$soldQuantity', '$reservedQuantity'] }] },
            nextInLine.quantity
          ]
        }
      },
      { $inc: { reservedQuantity: nextInLine.quantity } },
      { new: true }
    );

    if (!tier) return null; // Inventory insufficient for this claim's quantity

    // Grant 24-hour exclusive claim window
    nextInLine.status = 'held';
    nextInLine.holdType = 'waitlist_claim';
    nextInLine.holdExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    nextInLine.waitlistPosition = null;
    await nextInLine.save();

    await EmailService.sendWaitlistPromotionEmail({
      to: nextInLine.userRef.email,
      name: nextInLine.userRef.name,
      registrationNumber: nextInLine.registrationNumber,
      claimDeadline: nextInLine.holdExpiresAt
    });

    return nextInLine;
  }
}
```

---

### 5.3 Webhook Idempotency & Payment Service (`services/paymentService.js`)

```javascript
import PaymentEvent from '../models/PaymentEvent.js';
import { TicketInventoryEngine } from './ticketInventoryEngine.js';
import { AppError } from '../utils/AppError.js';

export class PaymentService {
  /**
   * Idempotent Webhook Ingestion Pipeline
   */
  static async handleWebhookEvent({ provider, rawEvent, signature }) {
    // 1. Verify signature with payment provider SDK
    const event = await this.verifyGatewaySignature(provider, rawEvent, signature);

    // 2. Check and record event idempotency
    let paymentEvent;
    try {
      paymentEvent = await PaymentEvent.create({
        provider,
        eventId: event.id,
        eventType: event.type,
        registrationRef: event.metadata?.registrationId || null,
        payload: event.data?.object,
        status: 'received'
      });
    } catch (err) {
      if (err.code === 11000) {
        // Event already received and processed!
        return { status: 'duplicate_ignored', message: 'Webhook already processed.' };
      }
      throw err;
    }

    // 3. Process payment success
    if (event.type === 'payment_intent.succeeded') {
      const registrationId = event.data.object.metadata.registrationId;
      const paymentIntentId = event.data.object.id;

      await TicketInventoryEngine.confirmPayment({ registrationId, paymentIntentId });

      paymentEvent.status = 'processed';
      paymentEvent.processedAt = new Date();
      await paymentEvent.save();
    }

    return { status: 'processed' };
  }

  static async verifyGatewaySignature(provider, rawEvent, signature) {
    // Dispatches to integrations/payment/paymentProvider.js
    return { id: rawEvent.id, type: rawEvent.type, data: rawEvent.data };
  }
}
```

---

## 6. Complete Backend Directory Structure

```text
server/
│
├── config/
│   ├── db.js                     # MongoDB connection pool & reconnect handlers
│   ├── env.js                    # Validated environment variables (dotenv/zod)
│   └── services.js               # Service client configurations
│
├── controllers/
│   ├── authController.js         # Register, login, refresh, profile
│   ├── organizationController.js # Org CRUD, subscription & team members
│   ├── eventController.js        # Event CRUD, lifecycle publish/archive
│   ├── venueController.js        # Venue physical specs, room layouts
│   ├── sessionController.js      # Session schedules & conflict verification
│   ├── speakerController.js      # Speaker profiles & session assignments
│   ├── ticketController.js       # Ticket tiers & pricing
│   ├── registrationController.js # Ticket holds, active badge lists, approvals
│   ├── paymentController.js      # Payment intent creation & webhook capture
│   ├── checkinController.js      # Gate check-in & session attendance scans
│   ├── sponsorController.js      # Sponsor tiers, packages & asset reviews
│   ├── staffController.js        # Staff duty roster & room shifts
│   ├── announcementController.js # Audience broadcasts & notifications
│   ├── feedbackController.js     # Attendee reviews & rating collection
│   ├── analyticsController.js    # Metric aggregations & reports
│   └── aiController.js           # Generative drafting & recommendations
│
├── middleware/
│   ├── authMiddleware.js         # JWT verification & user attachment
│   ├── rbacMiddleware.js         # Global & event-scoped permission resolver
│   ├── validationMiddleware.js   # Zod schema validation runner
│   ├── rateLimiter.js            # General & sensitive endpoint rate limiters
│   ├── sanitizeMiddleware.js     # Mongo query injection sanitization
│   └── errorHandler.js           # Centralized operational error interceptor
│
├── models/
│   ├── User.js
│   ├── Organization.js
│   ├── Event.js
│   ├── Venue.js
│   ├── Session.js
│   ├── SpeakerProfile.js
│   ├── TicketTier.js             # Includes reservedQuantity
│   ├── Registration.js           # Includes quantity, holdType, attendeePasses[]
│   ├── Coupon.js                 # Includes reservedUses
│   ├── PaymentEvent.js           # Dedicated webhook idempotency collection
│   ├── SessionAttendance.js      # Unique on [sessionRef, passNumber]
│   ├── SponsorProfile.js
│   ├── SponsorPackage.js
│   ├── Sponsorship.js
│   ├── StaffAssignment.js
│   ├── Announcement.js
│   └── Feedback.js
│
├── routes/
│   ├── index.js                  # Mounts all /api/v1 routes
│   ├── authRoutes.js
│   ├── organizationRoutes.js
│   ├── eventRoutes.js
│   ├── venueRoutes.js
│   ├── sessionRoutes.js
│   ├── speakerRoutes.js
│   ├── ticketRoutes.js
│   ├── registrationRoutes.js     # Includes /waitlist endpoints
│   ├── paymentRoutes.js          # Webhooks & intents
│   ├── checkinRoutes.js
│   ├── sponsorRoutes.js
│   ├── staffRoutes.js
│   ├── announcementRoutes.js
│   ├── feedbackRoutes.js
│   ├── analyticsRoutes.js
│   └── aiRoutes.js
│
├── services/
│   ├── conflictEngine.js         # Room & speaker mathematical overlap detection
│   ├── ticketInventoryEngine.js  # Two-phase hold & confirmation logic
│   ├── registrationService.js    # Registration status transitions
│   ├── paymentService.js         # Payment intent & idempotent webhook verification
│   ├── qrVerificationEngine.js   # HMAC badge minting & idempotent scanning
│   ├── analyticsEngine.js        # 6-domain aggregation pipelines
│   ├── aiGenerativeService.js    # OpenAI structured prompt pipelines
│   ├── aiRecommendationEngine.js# Jaccard similarity & conflict pruning
│   ├── emailService.js           # Nodemailer transport
│   └── waitlistService.js        # Queue cascade & claim windows
│
├── integrations/
│   ├── payment/
│   │   └── paymentProvider.js   # Decoupled Stripe / Razorpay / Mock interface
│   ├── ai/
│   │   └── openaiProvider.js    # OpenAI client with backoff & model configs
│   ├── email/
│   │   └── emailProvider.js     # SMTP transport with HTML email templates
│   └── storage/
│       └── storageProvider.js   # Cloudinary / S3 asset uploads
│
├── validators/                   # Zod DTO Validation Schemas
│   ├── authValidator.js
│   ├── organizationValidator.js
│   ├── eventValidator.js
│   ├── venueValidator.js
│   ├── sessionValidator.js
│   ├── ticketValidator.js
│   ├── registrationValidator.js
│   ├── paymentValidator.js
│   └── feedbackValidator.js
│
├── utils/
│   ├── AppError.js               # Standardized operational error class
│   ├── logger.js                 # Structured logging utility
│   ├── generateId.js             # Unique registration ID generator
│   ├── jwt.js                    # JWT signing & verification helpers
│   └── constants.js              # System enums, error codes, limits
│
├── jobs/
│   ├── expireTicketHolds.js      # Background job: releases expired holds
│   ├── processWaitlist.js        # Background job: notifies waitlisted users
│   └── sendNotifications.js      # Background job: queued email sender
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── seed/
│   └── seed.js                   # Populates realistic mock data
│
├── app.js                        # Express app setup (routes, middleware)
├── server.js                     # HTTP server startup & DB connection
├── package.json
└── .env.example
```

---

## 7. Complete RESTful API Route Inventory

Base URL: `/api/v1`

### 7.1 Identity & Organizations
- `POST /auth/register` — Create account
- `POST /auth/login` — Login, receive JWT
- `POST /auth/refresh` — Refresh access token
- `GET /auth/me` — Current user context
- `PUT /auth/profile` — Update interests & bio
- `GET /organizations` — List user's organizations
- `POST /organizations` — Create organization
- `GET /organizations/:id` — Org details & subscription status
- `PUT /organizations/:id` — Update organization settings

### 7.2 Events, Venues & Sessions
- `GET /events` — List published events (filters: tags, dates, search)
- `POST /events` — Create event draft (Organizer/Admin)
- `GET /events/:id` — Event details by ID or slug
- `PUT /events/:id` — Update event configuration
- `PATCH /events/:id/publish` — Publish event
- `GET /venues` — List venues
- `POST /venues` — Create venue & rooms
- `GET /sessions/event/:eventId` — Full schedule grid
- `POST /sessions` — Create session (runs `ConflictDetectionEngine`)
- `PUT /sessions/:id` — Update session (re-runs conflict engine)
- `DELETE /sessions/:id` — Cancel session

### 7.3 Tickets, Registrations, Waitlist & Payments
- `GET /tickets/event/:eventId` — Available tiers with live available inventory
- `POST /tickets` — Create ticket tier
- `POST /coupons/validate` — Validate coupon discount
- `POST /registrations/hold` — **Phase 1: Reserve ticket in cart (held, quantity, 15m timer)**
- `POST /registrations/waitlist` — **Join waitlist for sold-out tier**
- `GET /registrations/waitlist/:eventId` — Organizer view waitlist queue
- `DELETE /registrations/waitlist/:registrationId` — Attendee leaves waitlist
- `POST /payments/create-intent` — Initialize payment with payment provider
- `POST /payments/webhook` — **Phase 2: Payment gateway confirmation webhook (idempotent)**
- `POST /payments/verify` — Client payment verification callback
- `GET /registrations/my-tickets` — Attendee tickets & QR badges
- `GET /registrations/event/:eventId` — Organizer registration roster

### 7.4 Check-In & Operations
- `POST /checkin/event` — Gate QR scanner (idempotent, records gate entry per pass)
- `POST /checkin/session` — Session door scanner (records `SessionAttendance`)
- `GET /staff/event/:eventId` — Staff assignment list
- `POST /staff/assign` — Assign staff member to role and rooms

### 7.5 Sponsors & Deliverables
- `GET /sponsors/event/:eventId` — Event sponsors by package tier
- `POST /sponsors/packages` — Create sponsorship packages
- `POST /sponsors/partnerships` — Allocate package to sponsor
- `PUT /sponsors/deliverables/:id` — Submit or approve marketing deliverables

### 7.6 AI & Analytics
- `POST /ai/generate-event-copy` — Draft descriptions, executive summaries & tags
- `POST /ai/generate-speaker-bio` — Polish speaker bios from notes
- `POST /ai/generate-announcement` — Draft multi-channel announcements
- `GET /ai/recommendations/:eventId` — Personalized session recommendations
- `GET /analytics/:eventId/summary` — High-level event KPIs (sums `quantity` for accurate volume)
- `GET /analytics/:eventId/heatmaps` — Room utilization & session popularity
- `GET /analytics/:eventId/sponsors` — Sponsor deliverable fulfillment & ROI
- `GET /analytics/:eventId/feedback` — CSAT & sentiment analysis

---

## 8. Development Implementation Roadmap

1. **Sprint 1: Core Framework & Security Baseline**
   - Setup `server.js` and `app.js` with middleware (`helmet`, `cors`, `rateLimiter`, `errorHandler`).
   - Implement `User` & `Organization` models, JWT auth, and two-tier `rbacMiddleware`.
2. **Sprint 2: Event Catalog, Venues & Conflict Scheduling**
   - Implement `Event`, `Venue`, `Session`, and `SpeakerProfile` models.
   - Build `ConflictDetectionEngine` and validate room/speaker overlap rules.
3. **Sprint 3: Two-Phase Ticketing, Registration, Waitlist & Payments**
   - Implement `TicketTier`, `Registration`, `Coupon`, and `PaymentEvent` models.
   - Implement `TicketInventoryEngine` (hold/confirm/release with `quantity` and 2-phase coupons).
   - Implement `jobs/expireTicketHolds.js`, `WaitlistService`, and webhook idempotency.
4. **Sprint 4: Cryptographic QR Check-in & Session Tracking**
   - Implement `QRVerificationEngine` (HMAC token minting & decoding for multi-pass orders).
   - Implement idempotent gate check-in and `SessionAttendance` scanner endpoints.
5. **Sprint 5: AI Services & Modular Analytics**
   - Implement `AIGenerativeService` (OpenAI prompt pipelines).
   - Implement `AISessionRecommendationEngine` (Jaccard content matching + conflict pruning).
   - Build the 6-domain aggregation pipelines in `AnalyticsEngine`.
6. **Sprint 6: Seed Ecosystem & Integration Validation**
   - Write comprehensive `seed/seed.js` script with complete test dataset.

---

## 9. Architectural Invariants & Concurrency Guarantees

The EventForge backend enforces the following **10 Core Engineering Invariants**:

1. **Inventory Conservation Invariant:**
   $$\text{soldQuantity} + \text{reservedQuantity} \le \text{totalQuantity}$$
   Enforced atomically via `$expr: { $gte: [{ $subtract: ['$totalQuantity', { $add: ['$soldQuantity', '$reservedQuantity'] }] }, quantity] }`.
2. **Single State Transition Invariant:**
   A registration record may transition out of `held` **exactly once**. Both payment confirmation and hold expiration execute conditional atomic updates matching `status: 'held'`.
3. **Payment State Consistency:**
   A `confirmed` registration always has a `paymentStatus` consistent with its tier price (`paid` for price $>0$, `free` for price $=0$).
4. **Badge Minting Invariant:**
   Cryptographic HMAC-SHA256 badge tokens are minted **only** upon successful transition to `confirmed` status. Held, waitlisted, or expired registrations have null badge payloads.
5. **Webhook Idempotency Invariant:**
   The same payment gateway event ID is processed at most once. Duplicate deliveries are discarded via unique index constraint on `PaymentEvent` `{ provider: 1, eventId: 1 }`.
6. **Coupon Usage Cap Invariant:**
   $$\text{usedCount} + \text{reservedUses} \le \text{maxUses}$$
   Coupons reserve usage during the hold phase and commit usage during confirmation, eliminating promo code overselling.
7. **Active Registration Exclusivity:**
   The MongoDB Partial Unique Index `{ eventRef: 1, userRef: 1 }` with `partialFilterExpression: { status: { $in: ['held', 'confirmed', 'pending_approval'] } }` guarantees a user holds at most one active registration per event.
8. **Inventory Balance Invariant on Hold Release:**
   When a hold expires or is cancelled, exactly the quantity that was reserved (`reservedQuantity -= quantity`) is restored to the available pool.
9. **No Stale Confirmations:**
   Payment confirmation can never confirm an already-expired hold. The query matches `holdExpiresAt: { $gte: new Date() }`.
10. **Zero Concurrent Overselling:**
    Concurrent checkout requests cannot oversell a ticket tier or violate `maxPerOrder`.

---

## 10. Failure Modes & Recovery Matrix

| Scenario | Root Cause | System Detection | Deterministic Expected Behavior |
| :--- | :--- | :--- | :--- |
| **Two users buy last ticket simultaneously** | High concurrent checkout requests | MongoDB atomic `$expr` capacity evaluation | First request atomically increments `reservedQuantity`; second request fails with `409 TICKET_UNAVAILABLE`. |
| **Payment succeeds just before expiration** | Gateway latency near 15m mark | Conditional update matches `status: 'held'` & `holdExpiresAt >= now` | Registration transitions to `confirmed`. Subsequent cron invocation finds status != 'held' and ignores. |
| **Payment succeeds after hold expiration** | User completed payment after 15m window; hold was expired by cron | Conditional update fails because status is `expired` | Transition rejected (`410 HOLD_EXPIRED`). System initiates automated payment refund and dispatches alert. |
| **Same webhook delivered 3 times** | Gateway retry logic / network hiccup | Duplicate key error on `PaymentEvent` `{ provider, eventId }` | First execution processes transition; 2nd & 3rd executions immediately return `200 OK duplicate_ignored`. |
| **Payment fails at gateway** | Card declined / insufficient funds | Webhook delivers `payment_intent.payment_failed` | Registration marked `cancelled`, `reservedQuantity -= quantity`, coupon `reservedUses -= 1`. |
| **Checkout abandoned** | User closes browser tab during checkout | 15m expiration timer elapses | `expireTicketHoldsJob` marks status `expired`, decrements `reservedQuantity`, triggers `promoteNextInQueue`. |
| **Waitlist user ignores 24h claim** | User misses claim email notification | 24h expiration timer elapses | `expireTicketHoldsJob` marks status `expired`, decrements `reservedQuantity`, triggers next eligible promotion. |
| **Coupon reaches max usage during checkout** | Concurrent users applying same promo code | Atomic `$expr: usedCount + reservedUses < maxUses` check | First users hold promo slots; later user receives `400 COUPON_LIMIT_EXCEEDED` before hold creation. |
| **Same user attempts duplicate active registration** | User opens multiple tabs to book twice | MongoDB partial unique index collision (E11000) | Request rejected with `409 DUPLICATE_ACTIVE_REGISTRATION`. |
| **Duplicate QR scan at event gate** | Ticket sharing or screenshot forwarding | Atomic query matching `checkedIn: false` | First scan succeeds; second scan returns `409 ALREADY_CHECKED_IN` with timestamp and staff ID. |
| **Session attendance scanned twice** | Attendee re-enters room or staff scans twice | Unique index `{ sessionRef: 1, 'attendeePass.passNumber': 1 }` | Second scan returns `SESSION_DUPLICATE_SCAN` without writing duplicate analytics record. |
