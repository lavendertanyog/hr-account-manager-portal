# HR Account Manager Portal

Separate web portal for Account Manager allocation approvals.

## Features

- Account Manager login at `/`
- Pending allocation review dashboard at `/dashboard`
- Approve/reject actions using backend APIs:
  - `GET /api/v1/allocations/pending-account-manager`
  - `PATCH /api/v1/allocations/:allocationId/account-manager-review`

## Setup

```bash
npm install
npm run dev
```

## Environment

Create `.env.local` from `.env.example`.

```bash
cp .env.example .env.local
```

## Build

```bash
npm run build
npm run start
```

## Deploy

```bash
npx vercel --prod
```
