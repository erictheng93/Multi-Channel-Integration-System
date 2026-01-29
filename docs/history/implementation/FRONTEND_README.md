
 Vue 3


- ** UI/UX**
- **** LINEFacebookInstagram WhatsApp
- ****
- **** UI
- **** TypeScript
- **** Pinia
- ****Vue Router
- **** Vite


- **Vue 3** - JavaScript
- **TypeScript** - JavaScript
- **Vite** -
- **Vue Router** - Vue.js
- **Pinia** - Vue
- **Axios** - HTTP


```
frontend/
 src/
 components/ #
 views/ #
 Login.vue #
 Dashboard.vue #
 Conversations.vue #
 ConversationDetail.vue #
 stores/ # Pinia
 auth.ts #
 conversations.ts #
 services/ # API
 api.ts # API
 types/ # TypeScript
 index.ts #
 router/ #
 index.ts #
 App.vue #
 main.ts #
 style.css #
 shared/ #
 types/
 index.ts #
 package.json #
 vite.config.ts # Vite
 tsconfig.json # TypeScript
 index.html # HTML
```


- /
-
-
-
-
-
-


1. **** (`/login`) -
2. **** (`/dashboard`) -
3. **** (`/conversations`) -
4. **** (`/conversations/:id`) -


- Node.js 18+
- npm yarn


```bash
cd frontend
npm install
```


```bash
npm run dev
```
 http://localhost:3000


```bash
npm run build
```


```bash
npm run preview
```

## API

 `/api` API Vite `http://localhost:8787`Cloudflare Workers

### API
- `POST /api/auth/login` -
- `GET /api/auth/me` -
- `GET /api/conversations` -
- `GET /api/conversations/:id` -
- `GET /api/conversations/:id/messages` -
- `POST /api/conversations/:id/messages` -
- `POST /api/conversations/:id/assign` -


 Pinia

- **authStore** -
- **conversationsStore** -


 TypeScript `shared/types/`


- CSS
-
- UI


1. API
2. API
3. Vue 3 Composition API
4. 