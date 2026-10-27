# ResQLink full-stack prototype

React + Vite frontend, Express API, MongoDB Atlas persistence, JWT authentication, and Vercel deployment configuration.

## Local setup
1. Install Node.js 18+.
2. In MongoDB Atlas, create a database user and allow your development IP in Network Access. Copy the Node.js connection URI.
3. Copy `.env.example` to `.env`, then fill in `MONGODB_URI` and a long random `JWT_SECRET`. Never commit `.env`.
4. In this folder run `npm install`, then `npm run dev`.
5. Vite runs the website (usually http://localhost:5173) and proxies `/api` requests to Express on port 5000.
6. Check `http://localhost:5000/health` for API/database status.

## API endpoints
- `GET /api/health` — service and database status
- `POST /api/auth/register` — create PATIENT, AMBULANCE or HOSPITAL account
- `POST /api/auth/login` — sign in and receive a JWT
- `GET /api/auth/me` — current authenticated account
- `GET /api/incidents` — list incidents
- `POST /api/incidents` — save an emergency report
- `PATCH /api/incidents/:id/status` — authenticated responder status update
- `GET /api/hospitals`, `GET /api/ambulances` — demo fleet data

## Vercel deployment
1. Push this folder to a GitHub repository. Make sure `.env` is not committed.
2. In Vercel, choose **Add New → Project**, import the repository, and deploy with the Vite defaults (`npm run build`, output `dist`).
3. In Vercel Project Settings → Environment Variables, add `MONGODB_URI` and `JWT_SECRET` for Production (and Preview if you use preview deployments).
4. Redeploy after adding or changing environment variables.
5. Open `https://your-project.vercel.app/api/health`; it should report `database: connected`.
6. Test register/login, submit an emergency, refresh, and verify the incident persists.

## Important security/product notes
- Public registration cannot create ADMIN accounts. Provision admins securely; never expose admin creation publicly.
- The sample responder status endpoint uses JWT role checks but needs tighter assignment-level authorization before real use.
- Map locations, ambulance/hospital records, ETA and ambulance movement are demo data. A real tracking system needs authenticated GPS ingestion and a real-time transport (WebSockets or polling).
- This academic prototype does not contact emergency services. Do not use real patient data until security, privacy, authorization, logging, and operational safety have been reviewed.
- Vercel functions are serverless; do not rely on in-memory state. MongoDB is the persistent data store.
