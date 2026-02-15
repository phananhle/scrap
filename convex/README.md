# Convex backend

## Phone auth (Twilio Verify)

Uses **Twilio Verify** so no “from” number is required. Set these **environment variables in your Convex dashboard** (Deployment → Settings → Environment Variables):

- `AUTH_TWILIO_ACCOUNT_SID` – Twilio account SID
- `AUTH_TWILIO_AUTH_TOKEN` – Twilio auth token
- `AUTH_TWILIO_SERVICE_SID` – Twilio Verify service SID (create a Verify service in Twilio console)

For local development:

```bash
npx convex env set AUTH_TWILIO_ACCOUNT_SID your_sid
npx convex env set AUTH_TWILIO_AUTH_TOKEN your_token
npx convex env set AUTH_TWILIO_SERVICE_SID your_verify_service_sid
```

## JWT keys (required for Convex Auth)

If you use `npx @convex-dev/auth` it can generate keys for you. Otherwise generate a key pair and set in Convex dashboard:

- `JWT_PRIVATE_KEY` – RS256 private key (PEM)
- `JWKS` – JSON Web Key Set (public key)

See [Convex Auth manual setup](https://labs.convex.dev/auth/setup/manual).
