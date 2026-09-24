# 📊 EventForge — Implementation Status

> **Architecture Reference:** `docs/BACKEND_ARCHITECTURE.md` (Version 2.1.0 — Implementation-Ready Architecture)  
> **Current Phase:** Phase 5 (AI Generative Services, Session Recommendations, Modular Analytics & Sponsor Management) — COMPLETE & VERIFIED  
> **Last Updated:** 2026-09-16  

---

## 1. Repository Audit & Baseline
- **Phase 1 Baseline:** 18 passing tests, 0 failures.
- **Phase 2 Baseline:** 30 passing tests, 0 failures.
- **Phase 3 Baseline:** 25 passing tests, 0 failures.
- **Phase 4 Baseline:** 30 passing tests, 0 failures.
- **Phase 5 Suite:** 31 passing tests, 0 failures.
- **Total Suite:** 134 passed, 0 failures across 61 suites.

---

## 2. Phase 1 Scope: Foundation + Security + Auth (VERIFIED)
- All Phase 1 models, services, middleware, and tests remain stable.

---

## 3. Phase 2 Scope: Event Catalog, Venues, Sessions, Speakers & Conflict Engine (VERIFIED & FROZEN)
- All Phase 2 models, conflict detection engine, RBAC middleware, and tests remain stable.

---

## 4. Phase 3 Scope: Ticket Inventory, Checkout Holds, Waitlist & Payments

### PHASE 3 — COMPLETE

#### Architecture:
`docs/BACKEND_ARCHITECTURE.md` (Version 2.1.0 — Implementation-Ready Architecture)

#### MongoDB Topology:
- **Replica Set:** Local MongoDB configured and running as a single-node replica set (`rs0`) via `/opt/homebrew/etc/mongod.conf`.
- **Transactions Verified:** Full multi-document ACID transactions tested with atomic rollback on abort and persistence on commit.

#### Models Created:
- `server/src/models/TicketTier.js`: Capacity accounting (`totalQuantity`, `soldQuantity`, `reservedQuantity`), sales windows (`salesStart`, `salesEnd`), `maxPerOrder`, and derived virtual `availableQuantity`.
- `server/src/models/Registration.js`: Multi-pass attendee array (`AttendeePassSubSchema`), hold types (`checkout`, `waitlist_claim`), payment statuses, and critical partial unique indexes:
  - Active Registration Guard: `{ eventRef: 1, userRef: 1 }` unique for active statuses (`held`, `confirmed`, `pending_approval`).
  - Active Waitlist Guard: `{ eventRef: 1, userRef: 1, ticketTierRef: 1 }` unique for `waitlisted`.
  - Queue Position Index: `{ ticketTierRef: 1, waitlistPosition: 1 }`.
- `server/src/models/Coupon.js`: Two-phase concurrency tracking (`maxUses`, `usedCount`, `reservedUses`), date intervals, and unique constraint `{ eventRef: 1, code: 1 }`.
- `server/src/models/PaymentEvent.js`: Durable webhook idempotency tracking with unique compound index `{ provider: 1, eventId: 1 }`.

#### Integrations:
- `server/src/integrations/payment/mockPaymentProvider.js`: Deterministic mock provider with cryptographic HMAC signature generation/verification and mock intent generation.
- `server/src/integrations/payment/paymentProvider.js`: Provider interface/dispatcher.

#### Services:
- `server/src/services/ticketInventoryEngine.js`:
  - Atomic two-phase ticket holds inside MongoDB transactions with `$expr` capacity checks.
  - Immediate free ticket ($0) fast-path confirmation with badge minting.
  - Concurrency-safe payment confirmation with single-exit state guard (`status: 'held', holdExpiresAt: { $gte: now }`).
- `server/src/services/waitlistService.js`:
  - Strict FIFO ordering (`waitlistJoinedAt ASC, waitlistPosition ASC`).
  - Atomic inventory reservation on waitlist promotion with 24-hour claim window.
  - Active registration exclusivity and duplicate waitlist prevention.
- `server/src/services/paymentService.js`:
  - Authoritative, idempotent webhook ingestion pipeline via `PaymentEvent` collection.
  - Client payment verification that verifies provider state rather than client claims.
- `server/src/services/qrVerificationEngine.js`:
  - HMAC-SHA256 signed badge token minting (`signBadgeToken`) executed upon ticket confirmation.

#### Background Jobs:
- `server/src/jobs/expireTicketHolds.js`: Transactional background worker executing conditional state transitions (`held` -> `expired`), releasing reserved inventory and coupon counts, and cascading promotions to the next eligible waitlisted candidate.

#### API Endpoints:
- `GET /api/v1/tickets/event/:eventId` — Available tiers with live derived available inventory
- `POST /api/v1/tickets` — Create ticket tier (Organizer/Admin)
- `GET /api/v1/tickets/:id` — Get ticket tier details
- `PUT /api/v1/tickets/:id` — Update ticket tier (Organizer/Admin)
- `DELETE /api/v1/tickets/:id` — Archive ticket tier (Organizer/Admin)
- `POST /api/v1/coupons/validate` — Validate coupon discount code
- `POST /api/v1/coupons` — Create coupon (Organizer/Admin)
- `GET /api/v1/coupons/event/:eventId` — List event coupons (Organizer/Admin)
- `POST /api/v1/registrations/hold` — Reserve ticket in cart (held, quantity, 15m timer)
- `POST /api/v1/registrations/waitlist` — Join waitlist for sold-out tier
- `GET /api/v1/registrations/waitlist/:eventId` — Organizer view waitlist queue
- `DELETE /api/v1/registrations/waitlist/:registrationId` — Attendee leaves waitlist
- `GET /api/v1/registrations/my-tickets` — Attendee tickets & QR badges
- `GET /api/v1/registrations/event/:eventId` — Organizer registration roster
- `GET /api/v1/registrations/:id` — Single registration details
- `POST /api/v1/payments/create-intent` — Initialize payment intent with provider
- `POST /api/v1/payments/webhook` — Payment gateway confirmation webhook (unauthenticated, signature-verified, idempotent)
- `POST /api/v1/payments/verify` — Client payment verification callback

#### Concurrency Tests:
- **Solo Seat Race:** `totalQuantity = 1`, 10 concurrent requests -> exactly 1 succeeded, 9 rejected with `TICKET_SOLD_OUT`, 0 oversold.
- **Batch Over-subscription:** `totalQuantity = 10`, 5 users requesting 4 tickets each (20 requested) -> reservedQuantity strictly capped at 10.
- **Payment vs Expiration Race:** Simultaneous `confirmPayment` and `expireTicketHoldsJob` on the same registration -> exactly one wins, zero inventory leak, zero negative reserved quantities.

#### Payment Idempotency:
- Duplicate webhook deliveries for the same `eventId` (`evt_duplicate_test_200`) return `duplicate_ignored` without double-crediting `soldQuantity` or double-consuming coupons.

#### Waitlist:
- Sequential FIFO queue position assignment verified (`waitlistPosition: 1, 2...`).
- Released inventory triggers `promoteNextInQueue`, transitions oldest entry to `held`, sets `holdType: 'waitlist_claim'`, grants 24h deadline, and **atomically reserves inventory**.
- Claim expiration releases inventory and cascades to promote the next candidate.

#### Coupon Protection:
- Concurrency test: `maxUses = 1`, 5 concurrent checkouts -> exactly 1 succeeds, 4 rejected with `COUPON_EXHAUSTED`, `usedCount + reservedUses <= maxUses`.

#### Total Tests:
- **73 passed**
- **0 failed**
  - `auth.test.js`: 18 passed
  - `venue.test.js`: 9 passed
  - `event.test.js`: 8 passed
  - `sessionConflict.test.js`: 13 passed
  - `ticketInventory.test.js`: 10 passed
  - `coupon.test.js`: 5 passed
  - `payment.test.js`: 5 passed
  - `waitlist.test.js`: 5 passed

#### Architecture Deviations:
- **None.** All 11 architectural invariants strictly observed and verified under concurrency.

---

## 5. Phase 4 Scope: Cryptographic QR Verification, Gate Check-In & Session Attendance

### PHASE 4 — COMPLETE

#### Architecture:
`docs/BACKEND_ARCHITECTURE.md` (Version 2.1.0 — Implementation-Ready Architecture)

#### Models Created:
- `server/src/models/StaffAssignment.js`: Operational role assignment (`checkin_staff`, `room_monitor`, `usher`, `support`, `general`), assigned room references, shift intervals, active/inactive status, and compound unique index `{ eventRef: 1, userRef: 1 }`.
- `server/src/models/SessionAttendance.js`: Admission log with attendee pass details (`passNumber`, `holderName`, `holderEmail`), staff scanner audit, timestamp, and compound unique index `{ sessionRef: 1, 'attendeePass.passNumber': 1 }`.

#### RBAC & Middleware Extension:
- `server/src/middleware/rbacMiddleware.js`: Extended `requireEventRole` with dynamic `event_staff` operational role authorization backed by active `StaffAssignment` records.

#### Cryptographic Engine & Services:
- `server/src/services/qrVerificationEngine.js`:
  - Dedicated HMAC-SHA256 badge verification (`verifyBadgeToken`) validating version prefix (`EFB1`), format, cryptographic signature, token expiration, and identity claims (`p`, `r`, `e`, `u`, `t`).
  - Pure verification architecture: non-mutating, zero database side-effects on verification.
- `server/src/services/checkInService.js`:
  - Operator access authorization (`verifyOperatorEventAccess`) ensuring operators have admin, organizer, or active event staff standing on the badge's target event.
  - Idempotent gate admission via atomic conditional update on `Registration.attendeePasses` with `{ 'attendeePasses.checkedIn': false }`.
  - Re-scans safely return `{ status: 'already_checked_in' }` without mutating timestamps or duplicating checks.
- `server/src/services/sessionAttendanceService.js`:
  - Strict gate prerequisite verification (`pass.checkedIn === true`), throwing 400 `GATE_CHECKIN_REQUIRED` on premature session entry.
  - Cross-event isolation enforcing badge event matching session event (`SESSION_EVENT_MISMATCH`).
  - Operator authorization check verifying staff authority for the target session.
  - Concurrency-safe, managed multi-document transaction (`withTransaction`) atomically incrementing `Session.enrolledCount` with `$expr: { $lt: ['$enrolledCount', '$capacityLimit'] }` and creating `SessionAttendance`.
  - Capacity exhaust returns 409 `SESSION_FULL`.
  - Duplicate scan returns `{ status: 'already_attended' }` without double-incrementing enrollment.
- `server/src/services/staffService.js`:
  - Operational staff assignment and listing restricted to organizers and platform admins.

#### API Endpoints:
- `POST /api/v1/checkin/event` — Main gate scanner endpoint (idempotent attendee pass check-in)
- `POST /api/v1/checkin/session` — Session door scanner endpoint (capacity-enforced room admission)
- `POST /api/v1/staff/assign` — Assign operational staff member to event (Organizer/Admin)
- `GET /api/v1/staff/event/:eventId` — List operational staff for event (Organizer/Admin)

#### Concurrency Tests Verified:
- **Gate Check-In Race:** 20 concurrent requests for the same attendee pass -> exactly 1 state change transitions pass to `checkedIn: true`, 19 return `already_checked_in`.
- **Session Attendance Race:** 20 concurrent scans for the same pass at the same session -> exactly 1 `SessionAttendance` document created, 19 return `already_attended`, `enrolledCount = 1`.
- **Room Capacity Race:** Session with `capacityLimit = 2`, 5 concurrent eligible attendees race -> exactly 2 admitted (200 OK), 3 rejected with 409 `SESSION_FULL`, `enrolledCount` strictly capped at 2.

#### Test Results:
- **Phase 4 New Tests:** 30 passed, 0 failed across 4 test suites:
  - `qrVerification.test.js`: 7 passed
  - `gateCheckIn.test.js`: 12 passed
  - `sessionAttendance.test.js`: 7 passed
  - `staffManagement.test.js`: 4 passed
- **Full Suite (Phases 1–4):**
  - **103 passed**
  - **0 failed**
  - **43 test suites**

#### Architecture Deviations:
- **None.** All Phase 4 specifications and invariants strictly adhered to without modifying Phase 1–3 logic.

---

## 6. Phase 5 Scope: AI Generative Services, Session Recommendations, Modular Analytics & Sponsor Management

### PHASE 5 — COMPLETE & VERIFIED

#### Architecture:
`docs/BACKEND_ARCHITECTURE.md` (Version 2.1.0 — Implementation-Ready Architecture)

#### Models Created:
- `server/src/models/SponsorProfile.js`: Organization-scoped company brand identity with compound unique index `{ organizationRef: 1, name: 1 }`.
- `server/src/models/SponsorPackage.js`: Event-scoped tier packages (`headline`, `platinum`, `gold`, `silver`, `bronze`, `in_kind`, `community`, `custom`) with `price`, `maxSlots`, `allocatedSlots`, and unique `{ eventRef: 1, name: 1 }`.
- `server/src/models/Sponsorship.js`: Event-specific contract linking sponsor profile to package with deliverables subdocument array and unique `{ eventRef: 1, sponsorProfileRef: 1 }`.
- `server/src/models/Feedback.js`: Review model with 1–5 star ratings, `sentimentScore`, dimensional quality ratings, and unique `{ eventRef: 1, sessionRef: 1, userRef: 1 }`.

#### Integrations & Providers:
- `server/src/integrations/ai/mockAiProvider.js`: Deterministic mock provider with realistic schema-compliant responses and simulated failure triggers (`timeout`, `rate_limit`, `service_unavailable`, `malformed_json`).
- `server/src/integrations/ai/openaiProvider.js`: OpenAI client with `AbortController` timeout, `gpt-4o-mini`, and error mapping.
- `server/src/integrations/ai/aiProvider.js`: Provider dispatcher interface respecting `AI_PROVIDER` configuration.

#### Services:
- `server/src/services/aiGenerativeService.js`:
  - `generateEventCopy`, `generateSpeakerBio`, `generateAnnouncement` with strict Zod output schema validation (`eventCopyOutputSchema`, `speakerBioOutputSchema`, `announcementOutputSchema`).
  - Operator authentication and event-scoped authorization checks (`verifyOperatorEventAccess`).
  - Strict 502/503/504 error mapping for external provider failures.
- `server/src/services/aiSessionRecommendationEngine.js`:
  - Jaccard similarity interest matching: $J(A, B) = |A \cap B| / |A \cup B|$ computed over normalized feature sets (tags, track, type).
  - Strict event isolation and exclusion of already-attended sessions (`SessionAttendance`).
  - Interval overlap `(startA < endB && endA > startB)` conflict resolution separating sessions into conflict-free `recommendedItinerary` and `conflictingAlternatives` with conflicting window metadata.
  - Factual explainability strictly grounded in attendee profile interests and past attended topics.
- `server/src/services/analyticsEngine.js`:
  - 100% read-only, event-isolated native MongoDB aggregation pipelines:
  - `getEventSummaryKPIs`: accurately sums `$quantity` across confirmed registrations for ticket volume, sums `$totalAmountPaid` for gross revenue, and calculates gate check-in rate %.
  - `getSessionHeatmaps`: room utilization %, actual attendance count, and session popularity rankings.
  - `getSponsorMetrics`: total revenue, deliverable counts, and deliverable fulfillment rate %.
  - `getFeedbackAnalytics`: CSAT average rating, average sentiment score, rating histogram distribution (1–5 stars), and dimensional quality scores.
- `server/src/services/sponsorService.js`:
  - Company brand profile management scoped to organizations.
  - Tier package creation with unique constraints.
  - Atomic sponsorship allocation with slot capacity concurrency guard:
    `SponsorPackage.findOneAndUpdate({ _id, eventRef, status: 'active', $expr: { $lt: ['$allocatedSlots', '$maxSlots'] } }, { $inc: { allocatedSlots: 1 } })`
    with automatic `sold_out` transition.
  - Deliverable submission, asset linking, and staff approval workflow.
  - Public tier-grouped sponsor directory for attendees.

#### API Endpoints:
- `POST /api/v1/ai/generate-event-copy` — Draft descriptions, executive summaries & tags (Authenticated)
- `POST /api/v1/ai/generate-speaker-bio` — Polish speaker bios from notes (Authenticated)
- `POST /api/v1/ai/generate-announcement` — Draft multi-channel announcements (Organizer/Admin)
- `GET /api/v1/ai/recommendations/:eventId` — Personalized session recommendations (Attendee)
- `GET /api/v1/analytics/:eventId/summary` — High-level event KPIs (Organizer/Staff)
- `GET /api/v1/analytics/:eventId/heatmaps` — Room utilization & session popularity (Organizer/Staff)
- `GET /api/v1/analytics/:eventId/sponsors` — Sponsor deliverable fulfillment & ROI (Organizer/Staff)
- `GET /api/v1/analytics/:eventId/feedback` — CSAT & sentiment analysis (Organizer/Staff)
- `POST /api/v1/sponsors/profiles` — Create sponsor brand profile (Org Owner/Admin)
- `POST /api/v1/sponsors/packages` — Create sponsorship packages (Event Organizer)
- `POST /api/v1/sponsors/partnerships` — Allocate package to sponsor with atomic slot protection (Event Organizer)
- `PUT /api/v1/sponsors/deliverables/:id` — Submit or approve marketing deliverables (Staff/Organizer)
- `GET /api/v1/sponsors/event/:eventId` — Public event sponsor listing grouped by tier

#### Test Results:
- **Phase 5 New Tests:** 31 passed, 0 failed across 4 test suites:
  - `aiGenerative.test.js`: 8 passed
  - `aiRecommendations.test.js`: 5 passed
  - `analytics.test.js`: 7 passed
  - `sponsors.test.js`: 11 passed
- **Full Regression Suite (Phases 1–5):**
  - **134 passed**
  - **0 failed**
  - **61 test suites**

#### Architecture Deviations:
- **None.** All Phase 5 specifications, invariants, and boundaries strictly implemented.

---

## 7. Phase 6 Scope: Seed Ecosystem, Cross-Phase E2E Validation & Production Readiness

### PHASE 6 — COMPLETE

#### Architecture:
`docs/BACKEND_ARCHITECTURE.md` (Version 2.1.0 — Implementation-Ready Architecture)

#### Key Deliverables:

1. **Realistic Seed Ecosystem (`server/src/seed/seed.js`):**
   - Unconditional production safety guard (`NODE_ENV === 'production'` aborts without bypass).
   - Complete interconnected multi-tier dataset:
     - 2 Organizations (`TechVentures Global`, `InnovateCorp Labs`).
     - 8+ Users across all RBAC tiers (platform admin, org owners, organizers, gate staff, room monitors, keynote speakers, attendees).
     - Venues with embedded room hierarchy and realistic capacities.
     - Events across lifecycle states (`draft`, `published`, `ongoing`, `completed`, `cancelled`).
     - Multiple ticket tiers (`Early Bird`, `VIP All-Access`, `General Admission`, `Free Community Pass`) with valid inventory accounting.
     - Active percent/fixed coupons and exhausted coupons.
     - Confirmed registrations with minted HMAC-SHA256 QR badge tokens (`QRVerificationEngine.signBadgeToken`).
     - Operational staff assignments with role scopes (`checkin_staff`, `room_monitor`).
     - Multi-track sessions with verified non-conflicting schedules.
     - Session attendance records with gate check-in prerequisites.
     - Sponsor profiles, tier packages with slot tracking, and deliverables workflows.
     - Attendee session reviews with CSAT ratings, sentiment scores, and dimensional quality metrics.

2. **Cross-Phase End-to-End Test Suite (`server/src/tests/e2eIntegration.test.js`):**
   - **Full HTTP Boundary Journey:**
     - `POST /api/v1/registrations/hold`
     - `POST /api/v1/payments/create-intent`
     - `POST /api/v1/payments/webhook` (HMAC signature verified)
     - Ticket confirmation & cryptographic badge token generation
     - `POST /api/v1/checkin/event` (operator scans badge token)
     - `POST /api/v1/checkin/session` (door monitor admission)
     - `GET /api/v1/analytics/:eventId/summary` (accurate KPI verification)
     - `GET /api/v1/analytics/:eventId/heatmaps` (session utilization verification)
   - **Waitlist Full Lifecycle Integration:**
     - Sold-out tier -> Attendee joins waitlist -> Expiration job runs -> Oldest FIFO candidate promoted with 24h exclusive claim window -> Payment completed -> Confirmed registration.
   - **Deterministic Concurrency Protections:**
     - Ticket Inventory: 2 available tickets, 6 concurrent hold requests -> at most 2 succeed, 0 oversold.
     - Coupon Limit Race: `maxUses = 2`, 5 concurrent checkouts -> at most 2 coupon reservations succeed, maxUses never exceeded.
     - Gate Duplicate Check-In Race: 5 concurrent scans of the same pass -> exactly 1 `checked_in`, 4 `already_checked_in`.
     - Session Door Capacity Race: `capacityLimit = 2`, 5 concurrent gate-checked attendees -> exactly 2 admitted, 3 rejected with 409 (`SESSION_FULL`).
   - **Sponsor Allocation Rollback Safety:**
     - Simulated failure during sponsorship creation triggers safe slot decrement with `{ allocatedSlots: { $gt: 0 } }` guard to prevent negative counter under concurrency.
   - **Production Seed Guard Test:**
     - Automated test verifying `runSeed()` throws an error in `NODE_ENV = 'production'`.
   - **Physical Database Index Verification Audit:**
     - Inspects actual MongoDB collection indexes via `collection.listIndexes()`:
       - `Registration`: Active registration partial unique index, active waitlist partial unique index, waitlist FIFO queue position index.
       - `PaymentEvent`: `{ provider: 1, eventId: 1 }` unique index.
       - `StaffAssignment`: `{ eventRef: 1, userRef: 1 }` unique index.
       - `SessionAttendance`: `{ sessionRef: 1, 'attendeePass.passNumber': 1 }` unique index.
       - `SponsorPackage`: `{ eventRef: 1, name: 1 }` unique index.
       - `SponsorProfile`: `{ organizationRef: 1, name: 1 }` unique index.
       - `Feedback`: `{ eventRef: 1, sessionRef: 1, userRef: 1 }` unique index.
       - `Coupon`: `{ eventRef: 1, code: 1 }` unique index.
   - **Two-Tier Health Check Endpoint:**
     - `/api/v1/health` verified to return 200 OK with `healthy` and `database: 'connected'`, or 503 if disconnected.

#### Test Results:
- **Phase 6 New Tests:** 10 passed, 0 failed across 8 suites in `e2eIntegration.test.js`.
- **Full Backend Regression Suite (Phases 1–6):**
  - **144 passed**
  - **0 failed**
  - **69 test suites**
  - **Total execution time:** ~98s

---

## 8. Summary of All Phases

| Phase | Description | Status | Tests Passed | Failures |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Foundation, Security, Multi-tenant Auth & RBAC | COMPLETE | 18 | 0 |
| **Phase 2** | Event Catalog, Venues, Sessions, Conflict Engine | COMPLETE | 30 | 0 |
| **Phase 3** | Inventory, Holds, Waitlist, Payments, Webhooks | COMPLETE | 25 | 0 |
| **Phase 4** | QR Verification, Gate Check-In, Session Attendance | COMPLETE | 30 | 0 |
| **Phase 5** | AI Services, Recommendations, Analytics, Sponsors | COMPLETE | 31 | 0 |
| **Phase 6** | Seed Ecosystem, Cross-Phase E2E, Hardening | COMPLETE | 10 | 0 |
| **TOTAL** | **EventForge Unified Production Backend** | **COMPLETE** | **144** | **0** |

---

## 9. Production Integrations & Frontend Application

### Production-Ready Stripe Integration:
- `server/src/integrations/payment/stripePaymentProvider.js`:
  - Official `stripe` SDK integration (`^22.6.2`).
  - Production `createPaymentIntent` creating real Stripe PaymentIntents in cents with metadata and automatic payment methods.
  - Production webhook signature verification using `stripe.webhooks.constructEvent` with `stripe-signature` header and `STRIPE_WEBHOOK_SECRET`.
  - Production webhook event ingestion mapping `payment_intent.succeeded` and `payment_intent.payment_failed` into normalized EventForge events.
  - Production status verification using `stripe.paymentIntents.retrieve`.
  - Dynamic provider selection in `PaymentProvider` defaulting to Stripe when `STRIPE_SECRET_KEY` is present.

### Production-Ready OpenAI Integration:
- `server/src/integrations/ai/openaiProvider.js`:
  - Direct OpenAI API integration (`gpt-4o-mini`) using `response_format: { type: 'json_object' }`.
  - Structured output parsing validated through strict Zod schemas with fallback error mapping (504 timeout, 429 rate limit, 503 unavailable, 502 schema rejection).
  - Dynamic provider selection in `AIProvider` automatically activating OpenAI when `OPENAI_API_KEY` is configured.

### Full-Stack MERN Frontend Application (`frontend/`):
- **Framework**: React 19 with Vite (`^8.3.0`).
- **Styling**: Tailwind CSS v3 (`^3.4.17`), PostCSS, Autoprefixer, modern dark mode glassmorphism (`#080b11`), Google Fonts (`Outfit`, `Inter`).
- **Pages**:
  - `HomePage`: Hero with real-time stats and featured upcoming conferences.
  - `EventsPage`: Complete searchable, filterable catalog with live badges and pricing.
  - `EventDetailPage`: Rich overview, schedule tabs, speaker details, venue coordinates, dynamic ticket selector, 15-minute countdown checkout hold modal, and instant payment confirmation.
  - `MyTicketsPage`: Attendee badge wallet displaying cryptographic QR badges, token clipboard helper, and Jaccard-distance AI session recommendations.
  - `CheckInStationPage`: Gate scanning terminal and session room check-in with live capacity meter and duplicate prevention.
  - `OrganizerDashboardPage`: Event draft creator with AI Copilot, conflict-checked session scheduler, and targeted multi-channel AI announcement broadcaster.
  - `AnalyticsPage`: Executive KPI cards, session attendance heatmaps, sponsor ROI leaderboards, and attendee CSAT ratings.
  - `LoginPage` & `RegisterPage`: Clean authentication forms with 1-click persona quick-switchers for all 5 enterprise roles.

