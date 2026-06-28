# Build Tracker — App Overview
*Single HTML file PWA. No build tools. All state in localStorage. Syncs to Google Sheets via Apps Script.*

---

## Files

| File | Purpose |
|------|---------|
| `health-tracker.html` | Entire app — HTML + CSS + JS in one file |
| `sheets-sync.js` | Google Apps Script (deployed as Web App). Paste into script.google.com |
| `icons/dumbbell_11421684.png` | Workout nav icon (black on white PNG) |
| `icons/cutlery_3141448.png` | Log Food nav icon (black on white PNG) |
| `icons/settings-cog.svg` | Settings nav icon (SVG) |
| `withings-callback/index.html` | GitHub Pages relay page for Withings OAuth |
| `md/` | Documentation |
| `pdf/` | Source research PDFs |
| `data/` | Raw Withings CSV export |

---

## Architecture

```
health-tracker.html
│
├── CSS (design tokens, components)
├── HTML (6 screens, 1 nav)
└── JS (state, render functions, API calls)
    │
    ├── localStorage (bb_state) ←→ all user data
    ├── Google Apps Script (POST) ← workout / progress / food logs
    └── Apps Script (GET) ← Withings sync / token exchange
```

**State object (`bb_state` in localStorage):**
```json
{
  "currentWeight": 179.5,
  "currentBF": 15.0,
  "currentMuscle": 148.8,
  "currentWaist": 33.5,
  "currentPhase": "cut",
  "progressLog": [...],
  "foodLog": [...],
  "workoutLog": [...],
  "dailyProtein": { "2026-06-27": 168 }
}
```

---

## 6 Screens (Bottom Nav)

### 1. Home (`screen-home`)
- Greeting + date
- Today's workout card (auto-detects day of week → workout day)
- Weight + Body Fat cards (from last Progress log)
- **Nutrition Today** card — stacked segmented bar (protein/carbs/fat by calories) + dot rows with grams vs target
- This Week stats: sessions, avg protein, weight trend, waist
- Targets card: goal weight, lbs to go, estimated weeks, lean mass

### 2. Workout (`screen-workout`)
- Day pill selector (Mon Upper A / Tue Lower A / Thu Upper B / Fri Lower B / Arms+Core)
- Exercise cards with sets/reps/rest/notes
- Finish Workout button → logs to Sheets + increments weekly session count

### 3. Nutrition (`screen-nutrition`)
- Phase macro grid (4 boxes: Cal / Protein / Carbs / Fat) — updates based on active phase in Settings
- Today Is toggle (Training / Rest) → shows day-specific carb/fat targets
- Meal Timing guide
- Supplements list

### 4. Progress (`screen-progress`)
- **Withings Scale card** — Sync Now button (after connecting) → pulls latest weight/fat/muscle/bone/BF% → Use This Reading pre-fills form
- Manual log form (weight / waist / fat mass / muscle)
- Body Composition display (current values)
- vs Apr 17 Start comparison
- Log history (last 10 entries)

### 5. Log Food (`screen-food`)
- Yesterday / Today date toggle
- Daily totals bar (calories vs target)
- Meal sections: Breakfast / Lunch / Dinner / Snacks — each with + Add button and food list
- **Barcode scanner** (BarcodeDetector API, iOS 17+ / Safari) — opens camera, scans every 400ms, looks up barcode on Open Food Facts API
- **Add Food** button — manual form (name, brand, serving size, cal/protein/carbs/fat)
- Serving size adjuster on scanned items (updates macros proportionally)
- All entries sync to Google Sheets "Food Log" tab

### 6. Settings (`screen-stack`)
- **Current Phase** selector (Cut / Transition / Lean Bulk) — updates all macro targets app-wide
- Stack info: Tirzepatide, HGH
- Labs (May 26): hormone panel, lipids
- Periodization notes
- **Withings Scale** — Connect button → OAuth flow → Sync enabled
- **Google Sheets** — Apps Script URL input + Save + Test

---

## Data Flows

### Food Logging
```
User scans barcode
  → BarcodeDetector API detects code
  → fetch open Food Facts API (/api/v2/product/{barcode}.json)
  → parse nutriments per 100g
  → user adjusts serving size
  → pushFoodEntry() → state.foodLog.push(entry) → saveState()
  → syncToSheets({ type: 'food', ... }) → POST to Apps Script
  → renderFoodLog() + renderMacroSnapshot()
```

### Progress / Withings Sync
```
User taps Sync Now
  → GET Apps Script ?action=withings_latest
  → Apps Script: getAccessToken() → fetch Withings measure API
  → returns { weight, fatMass, muscle, bone, fatPct, hydro } in lb
  → showWithingsReading() → grid of 6 values
  → User taps Use This Reading → fills log-weight / log-fat / log-muscle inputs
  → logProgress() → state.progressLog.push() → syncToSheets({ type: 'progress', ... })
```

### Withings OAuth (one-time setup)
```
User taps Connect
  → GET Apps Script ?action=withings_auth_url&redirect_uri=[github pages url]
  → Apps Script reads WITHINGS_CLIENT_ID from Script Properties
  → returns Withings authorization URL
  → window.open(authUrl)
  → User authorizes on Withings
  → Withings redirects to https://ericdoesit.github.io/withings-callback/
  → callback page fetches: GET Apps Script ?action=exchange_withings&code=xxx&redirect_uri=...
  → Apps Script exchanges code for tokens, stores in Script Properties
  → callback page shows "Connected"
  → HTML app polls ?action=withings_status → detects connected → updates UI
```

---

## Google Apps Script (`sheets-sync.js`)

**Deploy:** script.google.com → New project → paste code → Deploy as Web App (Execute as: Me, Anyone can access)

**Endpoints:**

| Type | Method | Action | Description |
|------|--------|--------|-------------|
| POST | `doPost` | `type=workout` | Log workout to Workouts sheet |
| POST | `doPost` | `type=progress` | Log weigh-in to Progress sheet |
| POST | `doPost` | `type=food` | Log food entry to Food Log sheet |
| POST | `doPost` | `type=test` | Test connection |
| GET | `doGet` | `action=withings_auth_url` | Returns Withings OAuth URL |
| GET | `doGet` | `action=exchange_withings` | Exchanges OAuth code for tokens |
| GET | `doGet` | `action=withings_status` | Returns {connected: true/false} |
| GET | `doGet` | `action=withings_latest` | Returns latest measurement from Withings |
| GET | `doGet` | `action=withings_sync` | Fetches 30-day history, writes to Body Comp sheet |

**Script Properties (set manually in Apps Script settings):**
- `WITHINGS_CLIENT_ID`
- `WITHINGS_CLIENT_SECRET`
- `WITHINGS_ACCESS_TOKEN` (auto-set after OAuth)
- `WITHINGS_REFRESH_TOKEN` (auto-set after OAuth)
- `WITHINGS_EXPIRES_AT` (auto-set after OAuth)
- `WITHINGS_CONNECTED` (auto-set after OAuth)

**Google Sheet tabs auto-created:**
- Dashboard
- Workouts
- Progress
- Protein
- Food Log
- Body Comp (Withings) — written on sync

---

## Key Constants in HTML

```javascript
const SHEETS_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycb.../exec';

const PHASES = {
  cut:        { cal: 2100, protein: 215, fat: 65,  carbs: 195, trainCarbs: 225, trainFat: 50,  restCarbs: 160, restFat: 75 },
  transition: { cal: 2500, protein: 200, fat: 75,  carbs: 275, trainCarbs: 305, trainFat: 65,  restCarbs: 240, restFat: 85 },
  bulk:       { cal: 2800, protein: 185, fat: 65,  carbs: 362, trainCarbs: 410, trainFat: 55,  restCarbs: 310, restFat: 75 },
};

const WORKOUTS = [ /* 5 days */ ];
// Day map: Mon=0, Tue=1, Thu=2, Fri=3, optional=4
// Auto-detected from day of week in initHome()
```

---

## Barcode Scanner Notes
- Uses native `BarcodeDetector` API (no library)
- iOS 17+ / Safari required for camera access on iPhone
- Supported formats: ean_13, ean_8, upc_a, upc_e, code_128, code_39
- Scans video frames every 400ms
- On failure: falls back to Add Food manual form
- Scanner stops automatically when leaving Food tab (`goScreen()`)

---

## Deployed URLs
- **Apps Script:** `https://script.google.com/macros/s/AKfycbwHyd_UBOJAuYe6ux-j2NO79O-vIuf-nUo57xlLlZB9fWur-uATf4dXt8Zj_F9LAnj5mQ/exec`
- **Withings Callback:** `https://ericdoesit.github.io/withings-callback/`
- **Withings Developer Dashboard:** `https://developer.withings.com/dashboard/`

---

## Adding to iPhone Home Screen
1. Open `health-tracker.html` in Safari
2. Tap Share → Add to Home Screen
3. App runs full-screen, no browser chrome
4. Camera (barcode scanner) requires Safari — Chrome on iOS doesn't support BarcodeDetector
