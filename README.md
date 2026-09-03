# 🎯 EventForge

### Corporate Event & Conference Management Platform

> A full-stack MERN application for companies and event agencies to plan, manage, and execute conferences, workshops, exhibitions, and corporate events — powered by AI.

![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

---

## 📋 Table of Contents

- [About the Project](#about-the-project)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [User Roles](#user-roles)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [AI Integration](#ai-integration)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## 📖 About the Project

**EventForge** is a comprehensive event management platform built as a capstone project using the MERN stack. It enables organizations to seamlessly handle every aspect of corporate event management — from event creation and venue booking to speaker coordination, sponsor management, attendee registration, and real-time check-in.

The platform integrates AI capabilities to help organizers draft event content, generate speaker bios, create announcements, and recommend personalized sessions to attendees based on their interests and registration behavior.

---

## ✨ Features

### Core Features
- 🔐 **Authentication & Authorization** — JWT-based auth with role-based and event-scoped access control
- 📅 **Event Management** — Full CRUD for events, venues, sessions, speakers, sponsors, and announcements
- 🎟️ **Registration Workflow** — Ticket categories, capacity limits, waitlists, coupon codes, and approval states
- 📊 **Session Scheduling** — Room/time conflict detection with drag-and-drop scheduling
- 📱 **QR-Based Check-In** — QR code generation for registrations and scanner for event staff
- 🏢 **Sponsor Management** — Package allocation, deliverable tracking, and sponsor performance metrics

### AI-Powered Features
- 🤖 **Content Generation** — AI-drafted event descriptions, speaker bios, announcements, and session summaries
- 💡 **Session Recommendations** — Personalized session suggestions based on attendee interests and behavior

### Analytics & Reporting
- 📈 **Registration Trends** — Track registrations over time with visual charts
- 📊 **Attendance Analytics** — Session popularity, check-in rates, and capacity utilization
- ⭐ **Feedback Analysis** — Rating distributions, sentiment analysis, and feedback summaries
- 🏆 **Sponsor Performance** — ROI tracking and deliverable completion metrics

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, React Router, Axios, Recharts, React Icons |
| **Backend** | Node.js, Express.js 5 |
| **Database** | MongoDB with Mongoose ODM |
| **Authentication** | JWT (JSON Web Tokens), bcrypt |
| **AI** | OpenAI API (GPT) |
| **QR Codes** | qrcode (server), qrcode.react (client) |
| **Build Tool** | Vite |
| **Dev Tools** | Nodemon, dotenv, cors |

---

## 🏗️ Architecture

```
eventForge/
├── server/                      # Express.js Backend
│   ├── config/                  # Database & environment config
│   ├── controllers/             # Route handler logic
│   ├── middleware/               # Auth, validation, error handling
│   ├── models/                  # Mongoose schemas (16 models)
│   ├── routes/                  # REST API route definitions
│   ├── services/                # AI, QR, email services
│   ├── utils/                   # Helpers, constants, seed scripts
│   ├── validators/              # Request validation schemas
│   └── server.js                # Entry point
│
├── client/                      # React Frontend
│   ├── public/                  # Static assets
│   └── src/
│       ├── components/          # Reusable UI components
│       ├── contexts/            # React contexts (Auth, Theme)
│       ├── hooks/               # Custom hooks
│       ├── pages/               # Role-based page components
│       ├── services/            # API service layer
│       └── utils/               # Client-side helpers
│
├── .gitignore
└── README.md
```

---

## 👥 User Roles

| Role | Responsibilities |
|------|-----------------|
| **Platform Admin** | Manage organizations, subscription settings, users, and global policies |
| **Event Organizer** | Create events, manage venues, sessions, speakers, sponsors, and event operations |
| **Event Staff** | Handle check-in, session attendance, venue operations, and attendee support |
| **Speaker** | Manage speaker profile, sessions, presentation materials, and availability |
| **Attendee** | Register for events, select sessions, manage tickets, and provide feedback |
| **Sponsor** | Manage sponsorship packages, brand assets, and assigned deliverables |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **MongoDB** (local instance or [MongoDB Atlas](https://www.mongodb.com/atlas))
- **npm** (v9 or higher)
- **Git**
- **OpenAI API Key** (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Varun2526/EventForge.git
   cd EventForge
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/eventforge

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d

# OpenAI (for AI features)
OPENAI_API_KEY=your_openai_api_key_here
```

### Running the Application

1. **Start the backend server**
   ```bash
   cd server
   npm run dev
   ```

2. **Start the frontend** (in a new terminal)
   ```bash
   cd client
   npm run dev
   ```

3. **Seed the database** (optional — populates test data)
   ```bash
   cd server
   node utils/seed.js
   ```

The backend runs on `http://localhost:5000` and the frontend on `http://localhost:5173`.

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive JWT |
| GET | `/api/auth/me` | Get current user profile |
| POST | `/api/auth/logout` | Logout user |

### Events
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/events` | List all published events |
| POST | `/api/events` | Create a new event |
| GET | `/api/events/:id` | Get event details |
| PUT | `/api/events/:id` | Update event |
| DELETE | `/api/events/:id` | Delete event |
| PATCH | `/api/events/:id/publish` | Publish/unpublish event |

### Sessions
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/sessions/event/:eventId` | Get sessions by event |
| POST | `/api/sessions` | Create session (with conflict check) |
| PUT | `/api/sessions/:id` | Update session |
| DELETE | `/api/sessions/:id` | Delete session |

### Registrations
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/registrations` | Register for an event |
| GET | `/api/registrations/event/:eventId` | Get registrations by event |
| PATCH | `/api/registrations/:id/status` | Approve/reject/waitlist |
| PATCH | `/api/registrations/:id/checkin` | Check-in attendee |

### Additional Endpoints
| Resource | Prefix | Operations |
|----------|--------|-----------|
| Users | `/api/users` | CRUD, role management |
| Organizations | `/api/organizations` | CRUD |
| Venues | `/api/venues` | CRUD, room management |
| Speakers | `/api/speakers` | Profile CRUD, session assignments |
| Sponsors | `/api/sponsors` | Profile CRUD |
| Sponsorships | `/api/sponsorships` | Package allocation, deliverables |
| Sponsor Packages | `/api/sponsor-packages` | CRUD per event |
| Tickets | `/api/tickets` | CRUD, purchase tracking |
| Feedback | `/api/feedback` | Submit/view per event/session |
| Announcements | `/api/announcements` | CRUD, audience targeting |
| Coupons | `/api/coupons` | CRUD, validation |
| Staff | `/api/staff` | Assignment CRUD |
| Analytics | `/api/analytics` | Stats and reports |
| AI | `/api/ai` | Content generation, recommendations |

---

## 🗄️ Database Schema

The application uses **16 MongoDB collections** modeled with Mongoose:

```
User ─────────────┬──── Organization
                   │
Event ─────────────┤──── Venue (with Rooms)
  │                │
  ├── Session ─────┤──── SpeakerProfile
  ├── Ticket       │
  ├── Registration ┤──── SessionAttendance
  ├── Coupon       │
  ├── Announcement │
  ├── Feedback     │
  ├── StaffAssignment
  │
  ├── SponsorPackage
  └── Sponsorship ────── SponsorProfile
```

**Key Models:** User, Organization, Event, Venue, Session, SpeakerProfile, Registration, Ticket, SponsorProfile, Sponsorship, SponsorPackage, SessionAttendance, Feedback, Announcement, Coupon, StaffAssignment

---

## 🤖 AI Integration

EventForge leverages AI to streamline event management:

| Feature | Description |
|---------|-------------|
| **Event Descriptions** | Generate professional event descriptions from basic details |
| **Speaker Bios** | Draft compelling speaker biographies from profile information |
| **Announcements** | Create targeted announcements for different audience segments |
| **Session Summaries** | Auto-generate session summaries from titles and topics |
| **Session Recommendations** | Suggest sessions to attendees based on interests and past behavior |

AI features use the OpenAI API and are accessible via the `/api/ai` endpoints. Generated content is always presented as editable drafts that organizers can refine before publishing.

---

## 🧪 Test Data

Run the seed script to populate the database with meaningful test data:

```bash
cd server
node utils/seed.js
```

This creates:
- **Users**: 1 Admin, 2 Organizers, 3 Staff, 4 Speakers, 10 Attendees, 2 Sponsors
- **Events**: 3 events (conference, workshop, exhibition) with full configurations
- **Sessions**: 15+ sessions with schedules, rooms, and speaker assignments
- **Registrations**: Sample registrations with various statuses
- **Supporting Data**: Venues, tickets, sponsor packages, coupons, feedback, and announcements

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the ISC License.

---

## 👤 Author

**Varun** — [GitHub](https://github.com/Varun2526)

---

<p align="center">
  Built with ❤️ using the MERN Stack
</p>
