import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Venue from '../models/Venue.js';
import Event from '../models/Event.js';
import TicketTier from '../models/TicketTier.js';
import Coupon from '../models/Coupon.js';
import Registration from '../models/Registration.js';
import PaymentEvent from '../models/PaymentEvent.js';
import StaffAssignment from '../models/StaffAssignment.js';
import SpeakerProfile from '../models/SpeakerProfile.js';
import Session from '../models/Session.js';
import SessionAttendance from '../models/SessionAttendance.js';
import SponsorProfile from '../models/SponsorProfile.js';
import SponsorPackage from '../models/SponsorPackage.js';
import Sponsorship from '../models/Sponsorship.js';
import Feedback from '../models/Feedback.js';

import { QRVerificationEngine } from '../services/qrVerificationEngine.js';

dotenv.config();

/**
 * Executes seed population.
 * 
 * Strict Production Safety Rule:
 * Destructive clean-and-reseed operations are strictly forbidden in production.
 * If NODE_ENV === 'production', execution is unconditionally rejected.
 */
export async function runSeed({ silent = false } = {}) {
  const log = (...args) => {
    if (!silent) console.log(...args);
  };

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Destructive seed operations are strictly forbidden in production environment.');
  }

  log('🌱 Starting EventForge database seeding...');

  // Ensure DB connection if not connected
  if (mongoose.connection.readyState !== 1) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/eventforge_dev';
    await mongoose.connect(mongoUri);
    log(` Connected to database: ${mongoose.connection.name}`);
  }

  // 1. Clean existing records in reverse dependency order
  log('🧹 Purging existing collections...');
  await Promise.all([
    Feedback.deleteMany({}),
    SessionAttendance.deleteMany({}),
    Sponsorship.deleteMany({}),
    SponsorPackage.deleteMany({}),
    SponsorProfile.deleteMany({}),
    StaffAssignment.deleteMany({}),
    PaymentEvent.deleteMany({}),
    Registration.deleteMany({}),
    Coupon.deleteMany({}),
    TicketTier.deleteMany({}),
    Session.deleteMany({}),
    SpeakerProfile.deleteMany({}),
    Event.deleteMany({}),
    Venue.deleteMany({}),
    Organization.deleteMany({}),
    User.deleteMany({})
  ]);

  // Ensure indexes are built
  await Promise.all([
    Feedback.syncIndexes(),
    SessionAttendance.syncIndexes(),
    Sponsorship.syncIndexes(),
    SponsorPackage.syncIndexes(),
    SponsorProfile.syncIndexes(),
    StaffAssignment.syncIndexes(),
    PaymentEvent.syncIndexes(),
    Registration.syncIndexes(),
    Coupon.syncIndexes(),
    TicketTier.syncIndexes(),
    Session.syncIndexes(),
    SpeakerProfile.syncIndexes(),
    Event.syncIndexes(),
    Venue.syncIndexes(),
    Organization.syncIndexes(),
    User.syncIndexes()
  ]);

  // 2. Seed Users
  log('👤 Creating initial user accounts...');
  const commonPasswordHash = await bcrypt.hash('Password123!', 10);

  const users = await User.create([
    {
      name: 'System Admin',
      email: 'admin@eventforge.dev',
      passwordHash: commonPasswordHash,
      globalRole: 'platform_admin',
      jobTitle: 'Site Reliability Director',
      company: 'EventForge Core Inc.',
      interests: ['security', 'infrastructure', 'ai']
    },
    {
      name: 'Elena Rostova',
      email: 'owner@techforge.io',
      passwordHash: commonPasswordHash,
      globalRole: 'user',
      jobTitle: 'Chief Executive Officer',
      company: 'TechForge Global Inc.',
      interests: ['cloud', 'startups', 'keynotes']
    },
    {
      name: 'Marcus Vance',
      email: 'organizer@techforge.io',
      passwordHash: commonPasswordHash,
      globalRole: 'user',
      jobTitle: 'Head of Developer Relations',
      company: 'TechForge Global Inc.',
      interests: ['developer advocacy', 'hackathons']
    },
    {
      name: 'Sarah Jenkins',
      email: 'owner@apexinno.com',
      passwordHash: commonPasswordHash,
      globalRole: 'user',
      jobTitle: 'Managing Partner',
      company: 'Apex Innovations Group',
      interests: ['ai', 'enterprise']
    },
    {
      name: 'Dr. Alice Henderson',
      email: 'alice.speaker@techforge.io',
      passwordHash: commonPasswordHash,
      globalRole: 'user',
      jobTitle: 'Chief AI Architect',
      company: 'NeuroTech Labs',
      interests: ['machine learning', 'neural networks']
    },
    {
      name: 'Bob Martinez',
      email: 'bob.speaker@apexinno.com',
      passwordHash: commonPasswordHash,
      globalRole: 'user',
      jobTitle: 'Principal Security Engineer',
      company: 'CyberShield Systems',
      interests: ['zero trust', 'cryptography']
    },
    {
      name: 'Charlie Staff',
      email: 'charlie.staff@eventforge.dev',
      passwordHash: commonPasswordHash,
      globalRole: 'user',
      jobTitle: 'Lead Event Operations Marshal',
      company: 'EventForge Operations',
      interests: ['logistics']
    },
    {
      name: 'David Kim',
      email: 'dave.attendee@gmail.com',
      passwordHash: commonPasswordHash,
      globalRole: 'user',
      jobTitle: 'Senior Fullstack Engineer',
      company: 'Acme SaaS Corp',
      interests: ['microservices', 'react', 'node']
    },
    {
      name: 'Eva Green',
      email: 'eva.attendee@gmail.com',
      passwordHash: commonPasswordHash,
      globalRole: 'user',
      jobTitle: 'Product Manager',
      company: 'Horizon Cloud',
      interests: ['agile', 'ai', 'ux']
    },
    {
      name: 'Frank Miller',
      email: 'frank.attendee@gmail.com',
      passwordHash: commonPasswordHash,
      globalRole: 'user',
      jobTitle: 'Junior Developer',
      company: 'Indie Studio',
      interests: ['open source', 'web standards']
    }
  ]);

  const [
    adminUser,
    techforgeOwner,
    techforgeOrganizer,
    apexOwner,
    aliceSpeakerUser,
    bobSpeakerUser,
    charlieStaff,
    daveAttendee,
    evaAttendee,
    frankAttendee
  ] = users;

  // 3. Seed Organizations
  log('🏢 Creating organizations...');
  const orgTechForge = await Organization.create({
    name: 'TechForge Global Inc.',
    slug: 'techforge-global',
    website: 'https://techforge.io',
    ownerRef: techforgeOwner._id,
    members: [
      { userRef: techforgeOwner._id, role: 'owner' },
      { userRef: techforgeOrganizer._id, role: 'admin' }
    ],
    subscription: { tier: 'enterprise', status: 'active' }
  });

  const orgApex = await Organization.create({
    name: 'Apex Innovations Group',
    slug: 'apex-innovations',
    website: 'https://apexinno.com',
    ownerRef: apexOwner._id,
    members: [
      { userRef: apexOwner._id, role: 'owner' }
    ],
    subscription: { tier: 'pro', status: 'active' }
  });

  // Link users to their organizations
  techforgeOwner.organizationRef = orgTechForge._id;
  techforgeOrganizer.organizationRef = orgTechForge._id;
  apexOwner.organizationRef = orgApex._id;
  await Promise.all([techforgeOwner.save(), techforgeOrganizer.save(), apexOwner.save()]);

  // 4. Seed Venues & Rooms
  log('📍 Provisioning venues & physical room spaces...');
  const venueMetro = await Venue.create({
    name: 'Metropolitan Convention Center',
    organizationRef: orgTechForge._id,
    address: {
      street: '742 Market Street',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94103',
      country: 'USA',
      coordinates: { lat: 37.7879, lng: -122.4075 }
    },
    capacity: 2500,
    rooms: [
      { name: 'Grand Ballroom A', floor: '1st Floor', capacity: 1000, avEquipment: ['4K Projectors', 'Wireless Mics', 'Line Array Audio'] },
      { name: 'Quantum Hall', floor: '2nd Floor', capacity: 300, avEquipment: ['Laser Projector', 'Handheld Mics'] },
      { name: 'Cyber Stage', floor: '2nd Floor', capacity: 250, avEquipment: ['Dual LED Walls', 'Podium Mic'] },
      { name: 'Workshop Room 101', floor: '3rd Floor', capacity: 50, avEquipment: ['Smart Whiteboard', 'Power Hubs'] }
    ]
  });

  const venueApex = await Venue.create({
    name: 'Apex Tech Pavilion',
    organizationRef: orgApex._id,
    address: {
      street: '100 Congress Avenue',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'USA',
      coordinates: { lat: 30.2672, lng: -97.7431 }
    },
    capacity: 1200,
    rooms: [
      { name: 'Main Auditorium', floor: 'Ground Floor', capacity: 800, avEquipment: ['Full Stage Rig', 'Live Streaming Setup'] },
      { name: 'Breakout Alpha', floor: 'Mezzanine', capacity: 150, avEquipment: ['Projector', 'Audio Bar'] }
    ]
  });

  const roomGrandBallroom = venueMetro.rooms[0];
  const roomQuantumHall = venueMetro.rooms[1];
  const roomWorkshop = venueMetro.rooms[3];
  const roomApexAuditorium = venueApex.rooms[0];

  // 5. Seed Events (Lifecycle variety: published, ongoing, completed, draft, cancelled)
  log('📅 Creating multi-lifecycle events...');
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const nextMonthEnd = new Date(nextMonth.getTime() + 2 * 24 * 60 * 60 * 1000);

  const pastStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const pastEnd = new Date(pastStart.getTime() + 2 * 24 * 60 * 60 * 1000);

  const ongoingStart = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const ongoingEnd = new Date(now.getTime() + 20 * 60 * 60 * 1000);

  const futureDraftStart = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const futureDraftEnd = new Date(futureDraftStart.getTime() + 2 * 24 * 60 * 60 * 1000);

  // Event 1: Flagship Upcoming Conference (published)
  const eventSummit = await Event.create({
    title: 'TechForge World Summit 2026',
    slug: 'techforge-world-summit-2026',
    organizationRef: orgTechForge._id,
    organizerRef: techforgeOrganizer._id,
    type: 'conference',
    status: 'published',
    summary: 'The premier global convention on distributed intelligence and next-gen cloud systems.',
    description: 'TechForge World Summit brings together 2,000+ top software architects, engineers, and researchers to explore autonomous software, zero-trust cloud architectures, and quantum computing.',
    coverImageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87',
    startDate: nextMonth,
    endDate: nextMonthEnd,
    timezone: 'America/Los_Angeles',
    venueRef: venueMetro._id,
    totalCapacity: 2000,
    registeredCount: 2,
    tags: ['ai', 'cloud', 'architecture', 'kubernetes', 'security'],
    settings: { allowWaitlist: true, enablePublicSchedule: true }
  });

  // Event 2: Ongoing Event (ongoing)
  const eventOngoing = await Event.create({
    title: 'Cloud & AI Expo 2026',
    slug: 'cloud-and-ai-expo-2026',
    organizationRef: orgTechForge._id,
    organizerRef: techforgeOrganizer._id,
    type: 'conference',
    status: 'ongoing',
    summary: 'Live ongoing developer expo showcasing enterprise AI integrations.',
    description: 'Experience hands-on product launches and real-time live demonstrations.',
    startDate: ongoingStart,
    endDate: ongoingEnd,
    timezone: 'America/Los_Angeles',
    venueRef: venueMetro._id,
    totalCapacity: 1000,
    registeredCount: 170,
    tags: ['ai', 'cloud', 'expo']
  });

  // Event 3: Completed Workshop (completed)
  const eventCompleted = await Event.create({
    title: 'Developer Architecture Bootcamp 2025',
    slug: 'developer-architecture-bootcamp-2025',
    organizationRef: orgApex._id,
    organizerRef: apexOwner._id,
    type: 'workshop',
    status: 'completed',
    summary: 'Past comprehensive training camp on distributed event architectures.',
    description: 'An intensive three-day hands-on bootcamp.',
    startDate: pastStart,
    endDate: pastEnd,
    timezone: 'America/Chicago',
    venueRef: venueApex._id,
    totalCapacity: 300,
    registeredCount: 280,
    tags: ['architecture', 'microservices']
  });

  // Event 4: Draft Event (draft)
  const eventDraft = await Event.create({
    title: 'Global Tech Showcase 2027',
    slug: 'global-tech-showcase-2027',
    organizationRef: orgTechForge._id,
    organizerRef: techforgeOrganizer._id,
    type: 'exhibition',
    status: 'draft',
    summary: 'Preliminary blueprint for next year showcase.',
    description: 'Currently in planning stage.',
    startDate: futureDraftStart,
    endDate: futureDraftEnd,
    timezone: 'America/Los_Angeles',
    totalCapacity: 500
  });

  // Event 5: Cancelled Webinar (cancelled)
  const eventCancelled = await Event.create({
    title: 'Virtual DevOps Insights Webinar',
    slug: 'virtual-devops-insights-webinar',
    organizationRef: orgApex._id,
    organizerRef: apexOwner._id,
    type: 'webinar',
    status: 'cancelled',
    isVirtual: true,
    virtualMeetingUrl: 'https://meet.eventforge.dev/devops-webinar',
    summary: 'Cancelled virtual session due to speaker rescheduling.',
    description: 'Session deferred to future cycle.',
    startDate: nextMonth,
    endDate: nextMonthEnd,
    timezone: 'UTC',
    totalCapacity: 500
  });

  // 6. Seed Ticket Tiers
  log('🎟️ Creating ticket tiers with valid inventory constraints...');
  const tierVip = await TicketTier.create({
    eventRef: eventSummit._id,
    name: 'VIP All-Access Pass',
    description: 'Front-row seating, speaker lounge access, and exclusive VIP banquet.',
    price: 599,
    currency: 'USD',
    totalQuantity: 100,
    soldQuantity: 1,
    reservedQuantity: 0,
    salesStart: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    salesEnd: nextMonth,
    maxPerOrder: 5,
    perks: ['VIP Banquet', 'Speaker Lounge Access', 'Fast-Track Check-In']
  });

  const tierGeneral = await TicketTier.create({
    eventRef: eventSummit._id,
    name: 'General Admission',
    description: 'Full access to all keynote stages, breakout rooms, and expo hall.',
    price: 199,
    currency: 'USD',
    totalQuantity: 500,
    soldQuantity: 1,
    reservedQuantity: 0,
    salesStart: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    salesEnd: nextMonth,
    maxPerOrder: 10,
    perks: ['Conference Kit', 'Expo Hall Access']
  });

  const tierSoldOut = await TicketTier.create({
    eventRef: eventSummit._id,
    name: 'Early Bird Student Pass',
    description: 'Budget-friendly pass for verified university students.',
    price: 49,
    currency: 'USD',
    totalQuantity: 10,
    soldQuantity: 10,
    reservedQuantity: 0,
    salesStart: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
    salesEnd: nextMonth,
    maxPerOrder: 2,
    perks: ['Expo Access']
  });

  // 7. Seed Coupons
  log('🏷️ Creating discount coupons...');
  const couponEarlyBird = await Coupon.create({
    eventRef: eventSummit._id,
    code: 'EARLYBIRD20',
    discountType: 'percentage',
    discountValue: 20,
    maxUses: 100,
    usedCount: 5,
    reservedUses: 0,
    validFrom: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
    validUntil: nextMonth,
    applicableTierRefs: [tierGeneral._id],
    isActive: true
  });

  const couponVipDiscount = await Coupon.create({
    eventRef: eventSummit._id,
    code: 'TECHVIP50',
    discountType: 'fixed_amount',
    discountValue: 50,
    maxUses: 50,
    usedCount: 2,
    reservedUses: 0,
    validFrom: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
    validUntil: nextMonth,
    applicableTierRefs: [tierVip._id],
    isActive: true
  });

  const couponExpired = await Coupon.create({
    eventRef: eventSummit._id,
    code: 'EXPIRED30',
    discountType: 'percentage',
    discountValue: 30,
    maxUses: 10,
    usedCount: 10,
    reservedUses: 0,
    validFrom: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
    validUntil: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    isActive: false
  });

  // 8. Seed Speakers & Sessions
  log('🎤 Creating speaker profiles & schedule-conflict-free sessions...');
  const speakerAlice = await SpeakerProfile.create({
    eventRef: eventSummit._id,
    userRef: aliceSpeakerUser._id,
    fullName: 'Dr. Alice Henderson',
    headline: 'Chief AI Architect at NeuroTech Labs',
    bio: 'Pioneering researcher in large-scale autonomous neural architectures and distributed machine learning systems.',
    company: 'NeuroTech Labs',
    position: 'Chief AI Architect',
    topics: ['ai', 'neural networks', 'distributed systems'],
    status: 'confirmed'
  });

  const speakerBob = await SpeakerProfile.create({
    eventRef: eventSummit._id,
    userRef: bobSpeakerUser._id,
    fullName: 'Bob Martinez',
    headline: 'Principal Security Engineer at CyberShield',
    bio: 'Specialist in zero-trust architectures, post-quantum cryptography, and resilient enterprise cloud infrastructure.',
    company: 'CyberShield Systems',
    position: 'Principal Security Engineer',
    topics: ['security', 'cryptography', 'zero-trust'],
    status: 'confirmed'
  });

  // Non-conflicting multi-track agenda
  const sessionDay1Start = new Date(nextMonth.getTime() + 9 * 60 * 60 * 1000); // 09:00
  const sessionDay1KeynoteEnd = new Date(nextMonth.getTime() + 10.5 * 60 * 60 * 1000); // 10:30
  const sessionDay1BreakoutStart = new Date(nextMonth.getTime() + 11 * 60 * 60 * 1000); // 11:00
  const sessionDay1BreakoutEnd = new Date(nextMonth.getTime() + 12.5 * 60 * 60 * 1000); // 12:30
  const sessionDay1WorkshopStart = new Date(nextMonth.getTime() + 14 * 60 * 60 * 1000); // 14:00
  const sessionDay1WorkshopEnd = new Date(nextMonth.getTime() + 16 * 60 * 60 * 1000); // 16:00

  const sessionKeynote = await Session.create({
    eventRef: eventSummit._id,
    title: 'Opening Keynote: The Autonomous Software Frontier',
    description: 'Explore the converging paradigms of autonomous agent networks, real-time distributed orchestration, and high-performance computing.',
    type: 'keynote',
    track: 'Main Stage',
    roomId: roomGrandBallroom._id,
    roomName: roomGrandBallroom.name,
    startTime: sessionDay1Start,
    endTime: sessionDay1KeynoteEnd,
    speakerRefs: [speakerAlice._id],
    capacityLimit: 1000,
    enrolledCount: 2,
    tags: ['ai', 'agents', 'keynote'],
    status: 'scheduled'
  });

  const sessionSecurity = await Session.create({
    eventRef: eventSummit._id,
    title: 'Architecting Zero-Trust Cloud Systems at Scale',
    description: 'Deep dive into identity isolation, cryptographically verifiable payloads, and secure microservices.',
    type: 'breakout',
    track: 'Security & Cloud',
    roomId: roomQuantumHall._id,
    roomName: roomQuantumHall.name,
    startTime: sessionDay1BreakoutStart,
    endTime: sessionDay1BreakoutEnd,
    speakerRefs: [speakerBob._id],
    capacityLimit: 300,
    enrolledCount: 1,
    tags: ['security', 'cloud', 'architecture'],
    status: 'scheduled'
  });

  const sessionWorkshop = await Session.create({
    eventRef: eventSummit._id,
    title: 'Hands-on Neural Synthesis Workshop',
    description: 'Interactive lab where participants deploy and benchmark local reasoning models.',
    type: 'workshop',
    track: 'AI Engineering',
    roomId: roomWorkshop._id,
    roomName: roomWorkshop.name,
    startTime: sessionDay1WorkshopStart,
    endTime: sessionDay1WorkshopEnd,
    speakerRefs: [speakerAlice._id],
    capacityLimit: 50,
    enrolledCount: 0,
    tags: ['ai', 'workshop', 'hands-on'],
    status: 'scheduled'
  });

  // 9. Seed Staff Operational Roles
  log('🛡️ Assigning event staff operational roles...');
  const staffCharlieSummit = await StaffAssignment.create({
    eventRef: eventSummit._id,
    userRef: charlieStaff._id,
    role: 'checkin_staff',
    assignedRoomIds: [roomGrandBallroom._id, roomQuantumHall._id],
    status: 'active'
  });

  const staffCharlieOngoing = await StaffAssignment.create({
    eventRef: eventOngoing._id,
    userRef: charlieStaff._id,
    role: 'room_monitor',
    assignedRoomIds: [roomGrandBallroom._id],
    status: 'active'
  });

  // 10. Seed Registrations & Cryptographically Signed QR Badges
  log('🪪 Minting attendee registrations & cryptographic badge tokens...');
  
  // Registration 1: Dave Kim (VIP Pass, Confirmed & Checked-In)
  const regDavePassNumber = 'PASS-SEED-001';
  const regDaveNumber = 'REG-SEED-001';
  const regDaveBadgeToken = QRVerificationEngine.signBadgeToken({
    passNumber: regDavePassNumber,
    regNum: regDaveNumber,
    eventId: eventSummit._id.toString(),
    userId: daveAttendee._id.toString(),
    tierId: tierVip._id.toString()
  });

  const regDave = await Registration.create({
    eventRef: eventSummit._id,
    userRef: daveAttendee._id,
    ticketTierRef: tierVip._id,
    registrationNumber: regDaveNumber,
    quantity: 1,
    status: 'confirmed',
    paymentStatus: 'paid',
    totalAmountPaid: 599,
    attendeeDetails: {
      firstName: 'David',
      lastName: 'Kim',
      email: 'dave.attendee@gmail.com',
      company: 'Acme SaaS Corp',
      designation: 'Senior Fullstack Engineer',
      dietaryRequirements: 'None',
      tShirtSize: 'L'
    },
    attendeePasses: [
      {
        passNumber: regDavePassNumber,
        holderName: 'David Kim',
        holderEmail: 'dave.attendee@gmail.com',
        qrCodePayload: regDaveBadgeToken,
        checkedIn: true,
        checkedInAt: new Date(sessionDay1Start.getTime() - 30 * 60 * 1000),
        checkedInByStaffRef: charlieStaff._id
      }
    ]
  });

  // Registration 2: Eva Green (General Admission, Confirmed & Checked-In)
  const regEvaPassNumber = 'PASS-SEED-002';
  const regEvaNumber = 'REG-SEED-002';
  const regEvaBadgeToken = QRVerificationEngine.signBadgeToken({
    passNumber: regEvaPassNumber,
    regNum: regEvaNumber,
    eventId: eventSummit._id.toString(),
    userId: evaAttendee._id.toString(),
    tierId: tierGeneral._id.toString()
  });

  const regEva = await Registration.create({
    eventRef: eventSummit._id,
    userRef: evaAttendee._id,
    ticketTierRef: tierGeneral._id,
    registrationNumber: regEvaNumber,
    quantity: 1,
    status: 'confirmed',
    paymentStatus: 'paid',
    totalAmountPaid: 199,
    attendeeDetails: {
      firstName: 'Eva',
      lastName: 'Green',
      email: 'eva.attendee@gmail.com',
      company: 'Horizon Cloud',
      designation: 'Product Manager',
      dietaryRequirements: 'Vegetarian',
      tShirtSize: 'M'
    },
    attendeePasses: [
      {
        passNumber: regEvaPassNumber,
        holderName: 'Eva Green',
        holderEmail: 'eva.attendee@gmail.com',
        qrCodePayload: regEvaBadgeToken,
        checkedIn: true,
        checkedInAt: new Date(sessionDay1Start.getTime() - 20 * 60 * 1000),
        checkedInByStaffRef: charlieStaff._id
      }
    ]
  });

  // Registration 3: Frank Miller (Waitlisted on Sold-Out Tier)
  const regFrank = await Registration.create({
    eventRef: eventSummit._id,
    userRef: frankAttendee._id,
    ticketTierRef: tierSoldOut._id,
    registrationNumber: 'REG-SEED-WAIT-001',
    quantity: 1,
    status: 'waitlisted',
    paymentStatus: 'unpaid',
    totalAmountPaid: 0,
    waitlistPosition: 1,
    waitlistJoinedAt: new Date(),
    attendeeDetails: {
      firstName: 'Frank',
      lastName: 'Miller',
      email: 'frank.attendee@gmail.com',
      company: 'Indie Studio',
      designation: 'Junior Developer',
      tShirtSize: 'S'
    }
  });

  // 11. Seed Session Attendance
  log('🚪 Recording verified session door attendance...');
  await SessionAttendance.create([
    {
      sessionRef: sessionKeynote._id,
      eventRef: eventSummit._id,
      registrationRef: regDave._id,
      userRef: daveAttendee._id,
      attendeePass: {
        passNumber: regDavePassNumber,
        holderName: 'David Kim',
        holderEmail: 'dave.attendee@gmail.com'
      },
      scannedByStaffRef: charlieStaff._id,
      scannedAt: new Date(sessionDay1Start.getTime() + 5 * 60 * 1000)
    },
    {
      sessionRef: sessionKeynote._id,
      eventRef: eventSummit._id,
      registrationRef: regEva._id,
      userRef: evaAttendee._id,
      attendeePass: {
        passNumber: regEvaPassNumber,
        holderName: 'Eva Green',
        holderEmail: 'eva.attendee@gmail.com'
      },
      scannedByStaffRef: charlieStaff._id,
      scannedAt: new Date(sessionDay1Start.getTime() + 8 * 60 * 1000)
    },
    {
      sessionRef: sessionSecurity._id,
      eventRef: eventSummit._id,
      registrationRef: regDave._id,
      userRef: daveAttendee._id,
      attendeePass: {
        passNumber: regDavePassNumber,
        holderName: 'David Kim',
        holderEmail: 'dave.attendee@gmail.com'
      },
      scannedByStaffRef: charlieStaff._id,
      scannedAt: new Date(sessionDay1BreakoutStart.getTime() + 3 * 60 * 1000)
    }
  ]);

  // 12. Seed Sponsors, Packages & Deliverables
  log('💎 Creating sponsor ecosystem and marketing deliverables...');
  const sponsorProfileNeuroTech = await SponsorProfile.create({
    organizationRef: orgTechForge._id,
    name: 'NeuroTech Labs',
    description: 'Frontier AI accelerator building neuromorphic intelligence platforms.',
    websiteUrl: 'https://neurotechlabs.dev',
    contactPerson: {
      name: 'Victoria Song',
      email: 'partnerships@neurotechlabs.dev',
      phone: '+1-415-555-0199'
    }
  });

  const sponsorPackageHeadline = await SponsorPackage.create({
    eventRef: eventSummit._id,
    name: 'Headline Title Sponsor',
    tier: 'headline',
    price: 25000,
    currency: 'USD',
    maxSlots: 1,
    allocatedSlots: 1,
    status: 'sold_out',
    benefits: ['Keynote Stage Branding', '20 VIP Passes', 'Dedicated Exhibition Booth', 'Opening Remarks']
  });

  const sponsorPackageGold = await SponsorPackage.create({
    eventRef: eventSummit._id,
    name: 'Gold Enterprise Partner',
    tier: 'gold',
    price: 10000,
    currency: 'USD',
    maxSlots: 5,
    allocatedSlots: 0,
    status: 'active',
    benefits: ['Main Hall Banner', '5 Passes', 'App Logo Placement']
  });

  const sponsorshipHeadline = await Sponsorship.create({
    eventRef: eventSummit._id,
    sponsorProfileRef: sponsorProfileNeuroTech._id,
    packageRef: sponsorPackageHeadline._id,
    amountPaid: 25000,
    paymentStatus: 'paid',
    status: 'confirmed',
    deliverables: [
      {
        title: 'Keynote Stage Backdrop Vector Asset',
        description: 'High-res vector logo for main stage backdrop LED screen.',
        status: 'approved',
        assetUrl: 'https://cdn.eventforge.dev/sponsors/neurotech_backdrop.svg',
        submittedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        reviewedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        reviewedByStaffRef: techforgeOrganizer._id,
        notes: 'Approved for 4K display.'
      },
      {
        title: 'Conference Lanyard Print Proof',
        description: 'Lanyard graphic design proof.',
        status: 'submitted',
        assetUrl: 'https://cdn.eventforge.dev/sponsors/neurotech_lanyard.pdf',
        submittedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  // 13. Seed Attendee Feedback & Sentiment
  log('⭐ Storing attendee feedback and session evaluations...');
  await Feedback.create([
    {
      eventRef: eventSummit._id,
      sessionRef: sessionKeynote._id,
      userRef: daveAttendee._id,
      rating: 5,
      comment: 'Outstanding vision of autonomous software agents! The architectural breakdowns were world-class.',
      sentimentScore: 0.92,
      dimensions: { contentQuality: 5, speakerClarity: 5, venueEnvironment: 5 }
    },
    {
      eventRef: eventSummit._id,
      sessionRef: sessionKeynote._id,
      userRef: evaAttendee._id,
      rating: 4,
      comment: 'Very inspiring keynote, though sound balance near the rear seats could be improved.',
      sentimentScore: 0.70,
      dimensions: { contentQuality: 5, speakerClarity: 4, venueEnvironment: 4 }
    }
  ]);

  log('✅ EventForge database successfully seeded with realistic multi-entity graph.');

  return {
    summary: {
      organizations: 2,
      users: users.length,
      venues: 2,
      events: 5,
      ticketTiers: 3,
      coupons: 3,
      speakers: 2,
      sessions: 3,
      staffAssignments: 2,
      registrations: 3,
      attendeePasses: 2,
      sessionAttendances: 3,
      sponsorProfiles: 1,
      sponsorPackages: 2,
      sponsorships: 1,
      feedback: 2
    },
    entities: {
      adminUser,
      techforgeOwner,
      techforgeOrganizer,
      daveAttendee,
      evaAttendee,
      frankAttendee,
      charlieStaff,
      eventSummit,
      eventOngoing,
      tierVip,
      tierGeneral,
      tierSoldOut,
      sessionKeynote,
      sessionSecurity
    }
  };
}

// Direct CLI Invocation
const isMain = process.argv[1] && (
  process.argv[1].endsWith('seed.js') || 
  process.argv[1].endsWith('seed')
);

if (isMain) {
  runSeed()
    .then((result) => {
      console.log('Seed summary:', JSON.stringify(result.summary, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seeding failed:', err.message);
      process.exit(1);
    });
}
