# Bcrypt


### 1. bcrypt
- `src/utils/auth.ts` - `hashPassword()` bcrypt
- `src/utils/auth.ts` - `verifyPassword()` bcrypt SHA256
- `src/handlers/auth.ts` - bcrypt
- `src/handlers/team.ts` - bcrypt
- `src/handlers/auth-drizzle.ts` - Drizzle bcrypt

### 2. bcrypt
- `agents` bcrypt
 - admin@dacit.net: $2a$12$AVSzHYOJseo6vVDzX.XFCuuvWMrzImwARka/3AjPbO7VO9lKtwnRG
 - dacagent@dacit.net: $2a$12$N3XyZSTj.MGEnudWYHdBielDsW7YB5wGssKdab3Po0PrelPBtGqB6
- `app_users` bcrypt
 - admin@example.com: $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Gm.YG2
 - agent1@example.com: $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Gm.YG2

### 3.
- `verifyPassword()`
 - bcrypt
 - SHA256 with prefix (sha256$...)
 - SHA256 64
 - bcrypt


- **agents ** bcrypt
 - admin@dacit.net: $2a$12$AVSzHYOJseo6v... (bcrypt)
 - dacagent@dacit.net: $2a$12$N3XyZSTj.MGEn... (bcrypt)
- **app_users ** bcrypt
 - admin@example.com: $2a$12$LQv3c1yqBWVHx... (bcrypt)


```bash
wrangler d1 execute mcis-db --remote --file=./update-passwords-simple.sql
```
4 7


- [x] bcrypt (12 rounds)
- [x] bcrypt
- [x]
- [x]


- [x]
- [x] bcrypt
- [x]
- [x]


### bcrypt
- ****: admin@dacit.net / <ADMIN_PASSWORD>
- ****: dacagent@dacit.net / <AGENT_PASSWORD>

### bcrypt
- ****: admin@example.com / admin123
- ****: agent1@example.com / admin123


1. ****
 ```bash
 npm run deploy
 ```
 ID: 9a690331-9a52-429b-9f03-a0d2a8928076

2. ****
 ```bash
 wrangler d1 execute mcis-db --remote --file=./update-passwords-simple.sql
 ```
 4

3. ****
 - admin@dacit.net / <ADMIN_PASSWORD> -
 - dacagent@dacit.net / <AGENT_PASSWORD> -


- bcrypt (12 rounds) -
-
- bcrypt
-
-


1. **** bcrypt

2. ****bcrypt SHA256 12 rounds

3. ****