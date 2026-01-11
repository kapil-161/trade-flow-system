# Railway Deployment Guide

## Prerequisites
1. Railway CLI installed: `npm install -g @railway/cli`
2. Railway account authenticated: `railway login`
3. Project linked: `railway link -p 04acfda8-dffc-4487-831f-392bf236210e`

## Required Environment Variables

Set these in Railway Dashboard or via CLI:

### Database
- `DATABASE_URL` - Railway will auto-provide this when you add PostgreSQL

### Application
- `PORT` - Railway auto-provides this (defaults to 5000)
- `NODE_ENV` - Set to "production" (configured in railway.toml)

### Session Secret (if using sessions)
- `SESSION_SECRET` - Generate a random string for session encryption

## Setup Steps

### 1. Add PostgreSQL Database
```bash
railway add --database postgres
```

### 2. Push Database Schema
```bash
npm run db:push
```

### 3. Deploy Application
```bash
railway up
```

## Deployment Commands

- **Deploy**: `railway up`
- **View logs**: `railway logs`
- **Open app**: `railway open`
- **View environment**: `railway env`
- **Set environment variable**: `railway env set KEY=value`

## Build Process

The build process runs:
1. `npm install` - Install dependencies
2. `npm run build` - Build frontend and backend
3. `npm run start` - Start production server

## Post-Deployment

1. Check logs: `railway logs`
2. Verify database connection
3. Test application endpoints
4. Set up custom domain (optional)

## Troubleshooting

- **Build fails**: Check `railway logs`
- **Database connection**: Verify `DATABASE_URL` is set
- **Port issues**: Railway sets `PORT` automatically, app listens on `0.0.0.0`
