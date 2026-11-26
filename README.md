# Backend Project - Identity Authentication

## Included
- API Gateway health endpoint (port 4000)
- Identity Service (port 4001)
- User registration and login using bcrypt password hashing
- JWT access tokens and refresh-token rotation
- Hashed refresh-token storage and logout revocation
- Protected profile endpoint
- Postman collection

## Important database assumption
The existing Supabase `public.users` table is expected to have these columns: `id` (integer/serial), `name`, `email`, `phone`, `password`, and `created_at`. The Drizzle property `passwordHash` maps to the existing database column named `password`. This project does not recreate or alter that existing users table.

## Setup
1. Open a terminal in `identity-service`.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Fill in your own Supabase transaction-pooler connection string and two different strong JWT secrets. Do not commit or share `.env`.
5. In the Supabase SQL Editor, run `drizzle/0001_create_refresh_tokens.sql` once. It creates only the refresh-token table and index.
6. Run `npm run check`.
7. Run `npm run dev`. The service listens on `http://localhost:4001`.

For Supabase transaction pooler connections, use the pooler connection details supplied by your project administrator. `prepare: false` is configured for the postgres.js client.

## API endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/register` | Create account |
| POST | `/login` | Verify credentials and issue tokens |
| GET | `/profile` | Protected profile; Bearer access token required |
| POST | `/refresh-token` | Rotate a refresh token |
| POST | `/logout` | Revoke a refresh token |

### Registration JSON
```json
{ "name": "Test User", "email": "test.user@example.com", "phone": "9876543210", "password": "ChangeThisPassword123!" }
```
Password must be at least 10 characters and at most 72 UTF-8 bytes. Passwords are stored as bcrypt hashes.

### Login JSON
```json
{ "email": "test.user@example.com", "password": "ChangeThisPassword123!" }
```
The response contains `accessToken` and `refreshToken`. Store them securely in the client.

### Refresh/logout JSON
```json
{ "refreshToken": "<refresh-token-from-login>" }
```
Refresh tokens are stored in the database as SHA-256 hashes. Refresh rotates the old token; the old token cannot be reused. Logout revokes the presented refresh token. Access tokens remain valid until their short expiry because this implementation does not maintain an access-token denylist.

## Postman testing
1. Import `postman/Identity-Service.postman_collection.json` into Postman.
2. Keep `baseUrl` as `http://localhost:4001` if testing locally.
3. Change `testEmail` to a new email address you control and set a strong `testPassword`.
4. Run requests in order: Register, Login, Protected profile, Refresh, Logout, Verify old refresh token rejected.
5. The Login and Refresh requests automatically save tokens to collection variables.

The Postman collection is a test recipe; actual passing results require running it against your configured database and service.

## Existing accounts
The previous user row's password format was not verified in the supplied project. Login will work only if its `password` column contains a bcrypt hash produced by this implementation. Existing plain-text passwords must not be used as-is; arrange a secure password reset or migration with the project owner.

## API Gateway note
The supplied API Gateway currently exposes only `/health`; authentication requests in this collection go directly to the Identity Service on port 4001. Gateway proxy routing is not included in this authentication update.
