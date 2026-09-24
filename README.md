# Nexus Dental MVP

Nexus Dental is a multi-tenant dental clinic SaaS. This repository contains the Next.js application, including the public marketing site, patient OTP portal, and staff dashboard.

## Prerequisites
- Node.js (v18 or higher)
- PostgreSQL
- Redis

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd Nexus-Dental
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Copy the example environment file and update the values as needed.
   ```bash
   cp .env.example .env
   ```

4. **Database Setup & Seed**
   Make sure PostgreSQL is running and matches the `DATABASE_URL` in your `.env`. Then run:
   ```bash
   npm run db:setup
   ```
   This will run `prisma generate`, `prisma db push`, and the MVP seed script to populate the default tenant, users, and services.

5. **Run the Development Server**
   ```bash
   npm run dev
   ```

## Demo Accounts

Demo accounts are created by `npm run seed` with **random, one-time passwords printed to the console** (see `scripts/seed-users.js`). Seeding deletes data and refuses to run unless `SEED_ALLOW_DESTRUCTIVE=yes` is set against a disposable development database. Never seed a database that holds real data.

## Architecture
- **Framework:** Next.js (App Router)
- **Database:** PostgreSQL with Prisma ORM
- **Styling:** Tailwind CSS + Radix UI
- **Auth:** Custom JWT-based authentication (HTTP-only cookies + Bearer tokens)
- **State/Caching:** React Query (Client) & Redis (Server/Queue)
