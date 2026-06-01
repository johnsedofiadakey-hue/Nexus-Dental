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

## Default Seed Credentials

After running `npm run db:setup`, the following accounts are available:
- **System Owner:** `dev@nexusdental.com` / `dev123`
- **Clinic Owner (Admin):** `admin@nexusdental.com` / `admin123`
- **Receptionist:** `sarah@airporthills.com` / `staff123`
- **Doctor:** `dr.smith@airporthills.com` / `doctor123`

## Architecture
- **Framework:** Next.js (App Router)
- **Database:** PostgreSQL with Prisma ORM
- **Styling:** Tailwind CSS + Radix UI
- **Auth:** Custom JWT-based authentication (HTTP-only cookies + Bearer tokens)
- **State/Caching:** React Query (Client) & Redis (Server/Queue)
