# Cold Calling CRM

Private cold calling CRM with leads, editable pipeline, dashboard, flexible CSV imports, and SIP/WebRTC telephony integrated in the browser.

## Implemented features

- Login with an HTTP-only cookie and `ADMIN` / `AGENT` roles.
- Leads with predefined fields and `customFields` JSON for unknown CSV columns.
- CSV import with preview, manual mapping, ignored columns, custom fields, and phone/email deduplication.
- Kanban pipeline with drag and drop and automatic change history.
- Dashboard with basic metrics and charts.
- Automatic history for imports, notes, stages, and calls.
- `Call` button with SIP.js/WebRTC connected to Incredible PBX/Asterisk over WSS.
- PBX, WebRTC extension, users, and stages configuration.

## Local setup

1. Create/start PostgreSQL:

```bash
docker compose up -d postgres
```

2. Apply the schema and seed data:

```bash
npx prisma db push
npm run prisma:seed
```

3. Start the app:

```bash
npm run dev
```

Initial user:

- Email: `admin@example.com`
- Password: `admin1234`

## WebRTC telephony

The `Settings` screen expects:

- `sipWsUrl`: Asterisk/Incredible PBX WSS URL, for example `wss://pbx.example.com:8089/ws`.
- `sipDomain`: the PBX SIP domain.
- A new WebRTC extension, `702` recommended, with its own credentials.

Asterisk/Incredible PBX must have WebRTC/PJSIP configured with TLS/WSS. Modules such as `res_http_websocket`, `res_pjsip_transport_websocket`, and `res_crypto` are required.

## Production notes

- Change `SESSION_SECRET` and `SIP_CREDENTIAL_SECRET` in `.env`.
- Serve the CRM over HTTPS so microphone permissions and WSS work correctly.
- Do not reuse extension 701 if Linphone keeps it registered; configure a new extension for the CRM.
