# AutoBody Estimator - AI Coding Agent Instructions

## Project Overview
**Expo 54 / React Native 0.81** auto body shop management app for the **Georgian market** (locale: `ka-GE`, timezone: `Asia/Tbilisi`, currency: `₾ GEL`).

## Architecture

### Dual Routing (CRITICAL)
- `app/` → **Expo Router** (file-based) — **USE THIS** for all new features
- `App.js` + `src/screens/` → Legacy React Navigation Stack (do not add new screens here)

### Data Flow
```
Mobile App ─► Firebase Firestore (primary) ─► cPanel PHP API ─► MySQL
                    │
                    └── Firebase Storage (images, voice notes)
```

| Service | File | Purpose |
|---------|------|---------|
| Firebase | `src/services/firebase.js` | Firestore CRUD, Storage uploads |
| cPanel Sync | `src/services/cpanelService.js` | MySQL sync, Georgian transforms |
| Status Cache | `src/services/statusService.ts` | Fetches statuses, 24h AsyncStorage cache |

### Key Directories
| Path | Purpose |
|------|---------|
| `app/(tabs)/` | Tab screens: index, cases, service, completed, analytics, customers |
| `app/cases/[id].tsx` | Dynamic case detail screen |
| `src/config/constants.ts` | `COLORS`, `SPACING`, `TYPOGRAPHY` theme tokens |
| `src/config/services.ts` | `DEFAULT_SERVICES` with bilingual names |
| `src/config/georgian.ts` | `GEORGIAN_LABELS` for all UI strings |
| `src/types/index.ts` | TypeScript interfaces: Customer, Vehicle, Estimate, Invoice, Service |
| `cpanel-files/` | PHP API endpoints → upload to `public_html/api/mobile-sync/` |

## Critical Patterns

### 1. Bilingual Services (REQUIRED)
Every service MUST have both English and Georgian names:
```typescript
// src/config/services.ts
dent_repair: {
  key: 'dent_repair',
  nameEn: 'Dent Repair',
  nameKa: 'თუნუქის გასწორება',  // ← REQUIRED Georgian name
  basePrice: 80.00,
  category: 'bodywork',  // bodywork | painting | mechanical | specialized | finishing
}
```

### 2. cPanel PHP API Pattern
```php
// cpanel-files/example.php — EXACT structure required
<?php
define('API_ACCESS', true);       // ← MUST be line 1 (before require)
require_once 'config.php';
verifyAPIKey();                   // Validates X-API-Key header
// ... your logic ...
sendResponse(true, $data);        // Standardized JSON response
```

### 3. Theme Usage
```typescript
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/config/constants';
// COLORS.primary = '#2563EB', COLORS.success = '#10B981', COLORS.error = '#EF4444'
```

### 4. Georgian UI Labels
```typescript
import { GEORGIAN_LABELS } from '@/src/config/georgian';
// GEORGIAN_LABELS.save = 'შენახვა', GEORGIAN_LABELS.currencySymbol = '₾'
```

### 5. Service Transform (cPanel sync)
`cpanelService.js` auto-translates service names via `getGeorgianServiceName()` — always use service keys that match `DEFAULT_SERVICES`.

## Developer Commands
```bash
npx expo start              # Dev server (Expo Go)
npx expo start --clear      # Clear Metro cache
npm run android             # Build + run on Android device/emulator
npm run lint                # ESLint check
```

## Environment Variables (`.env`)
```bash
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_CPANEL_API_URL=https://domain.com/api/mobile-sync
EXPO_PUBLIC_CPANEL_API_KEY=...  # MUST match API_KEY in cpanel-files/config.php
```

## Gotchas
1. **New screens go in `app/`** — never add to `src/screens/` (legacy)
2. **Never hardcode Georgian text** — always use `src/config/georgian.ts`
3. **PHP files MUST start with** `define('API_ACCESS', true);` before any `require`
4. **Status type mapping**: App uses `case`/`repair`, API returns `case_status`/`repair_status`
5. **Path alias `@/`** maps to project root (e.g., `@/src/config/constants`)
6. **Tab layout** at `app/(tabs)/_layout.tsx` — uses `react-native-paper` + `expo-router`
7. **Root layout** wraps with `PaperProvider` and `ThemeProvider`
