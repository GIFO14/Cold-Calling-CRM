# Cold Calling CRM

CRM privat per cold calling amb leads, pipeline editable, dashboard, imports CSV flexibles i telefonia SIP/WebRTC integrada al navegador.

## Funcionalitats implementades

- Login amb cookie HTTP-only i rols `ADMIN` / `AGENT`.
- Leads amb camps predefinits i `customFields` JSON per columnes CSV desconegudes.
- Import CSV amb preview, mapping manual, columnes ignorades, custom fields i deduplicació per telèfon/email.
- Pipeline kanban amb drag-and-drop i historial automàtic de canvis.
- Dashboard amb mètriques i gràfiques bàsiques.
- Historial automàtic per imports, notes, stages i trucades.
- Botó `Call` amb SIP.js/WebRTC contra Incredible PBX/Asterisk via WSS.
- Configuració de PBX, extensió WebRTC, usuaris i stages.

## Setup local

1. Crea/arrenca PostgreSQL:

```bash
docker compose up -d postgres
```

2. Aplica l'esquema i dades inicials:

```bash
npx prisma db push
npm run prisma:seed
```

3. Arrenca l'app:

```bash
npm run dev
```

Usuari inicial:

- Email: `admin@example.com`
- Password: `admin1234`

## Telefonia WebRTC

La pantalla `Configuració` espera:

- `sipWsUrl`: URL WSS d'Asterisk/Incredible PBX, per exemple `wss://pbx.example.com:8089/ws`.
- `sipDomain`: domini SIP del PBX.
- Una extensió WebRTC nova, recomanada `702`, amb credencials pròpies.

Asterisk/Incredible PBX ha de tenir WebRTC/PJSIP configurat amb TLS/WSS. Calen mòduls com `res_http_websocket`, `res_pjsip_transport_websocket` i `res_crypto`.

## Notes de producció

- Canvia `SESSION_SECRET` i `SIP_CREDENTIAL_SECRET` a `.env`.
- Serveix el CRM per HTTPS perquè els permisos de micròfon i WSS funcionin correctament.
- No reutilitzis l'extensió 701 si Linphone la manté registrada; configura una extensió nova per al CRM.
