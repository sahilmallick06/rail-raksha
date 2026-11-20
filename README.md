# RailRaksha — AI-Powered Railway Traffic Control & Optimization Centre

**Smart India Hackathon Problem Statement SIH-25022 (Ministry of Railways)**  
**Institution:** The NorthCap University, Gurugram  
**Mentors:** Dr. Nidhi Malik, Dr. Manvi Breja  
**Team:** Sahil Mallick (23CSU271), Saiyam Taneja (23CSU273), Sarthak Sabharwal (23CSU284)

> **Academic Prototype Disclaimer:** RailRaksha is a functional academic prototype and human-in-the-loop decision-support platform. It is **not** a certified SIL-4 signalling or Automatic Train Protection (ATP / Kavach) system and does not transmit live commands to Indian Railways interlocking or COA networks.

---

## 1. Quick Start (macOS Terminal / Linux)

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Configure environment variables
cp .env.example .env
# Edit .env to optionally add GEMINI_API_KEY and/or RAILRADAR_API_KEY
# The app works fully out of the box in zero-quota cached + simulated mode without any API keys.

# 3. Run unit tests (kinematics, ML/SHAP/LIME, quota safeguards)
npx tsx --test src/engine/kinematics.test.ts src/server/quotaStore.test.ts

# 4. Start full-stack Control Centre (Express API + Vite frontend on port 3000)
npm run dev
```

Open **`http://localhost:3000`** for the cinematic 3D railway scroll intro, or **`http://localhost:3000/?autostart=1`** to jump straight into the Control Centre.

### Production Build & Type Check

```bash
npm run lint
npm run build
NODE_ENV=production npm start
```

---

## 2. Architecture & Data Provenance

Every number and decision in RailRaksha carries an explicit provenance class so faculty evaluators and controllers always know what is external, cached, simulated, synthetic ML, or human-approved:

| Provenance Class | Meaning |
| --- | --- |
| `THIRD_PARTY_REPORTED` | Station-level running status fetched manually from RailRadar API (never live GPS/track-circuit coordinates). |
| `CACHED` | Local cached snapshot served within the 30-min fresh cache or 7-day stale reuse window (0 external API calls). |
| `SIMULATED` | Real-time 4-track, 12 km, 30-block corridor kinematics and Babylon.js 3D Digital Twin telemetry. |
| `ML_PREDICTED_SYNTHETIC` | Advisory risk classification & SHAP/LIME-style attributions from models trained on 6,480 synthetic kinematic frames. |
| `DERIVED_ESTIMATE` | Counterfactual 20-second projections, plan comparison deltas, and AI Assistant contextual summaries. |
| `CONTROLLER_DECISION` | Persisted Human-in-the-Loop approvals, modifications, or rejections with replay IDs and audit notes. |

---

## 3. Feature Inventory (Implemented vs Simulated vs Research-Only)

| Capability | Status | Scope / Notes |
| --- | --- | --- |
| **3D Cinematic Railway Intro** | Implemented | Three.js 4-track corridor -> sleeper-to-command-grid scroll morph with Skip, Reduced Motion, `?autostart=1`, WebGL fallback, and GPU disposal. |
| **5 Primary Views** | Implemented | `Overview`, `Train Monitor`, `Conflict Centre`, `AI Dispatch`, `Digital Twin`. |
| **Secondary Controller Tools** | Implemented | `Timetable & Gantt`, `Scenario Lab`, `Decision History`, `Model Diagnostics`, `System Health & Quota`. |
| **4-Track Trunk Simulation (8 Rakes)** | Simulated | Trains `20818`, `22416`, `22439`, `12002`, `12306`, `12302`, `22824`, `SIM-FRT-01`; NDLS station throat (`α = 1.35×`); Clear/Rain/Thunderstorm/Fog multipliers. |
| **3D Digital Twin (Babylon.js V2)** | Simulated | Preserved at `/simulator/RailRaksha_SIH25022_RESEARCH_V2.html` with `BroadcastChannel('railraksha-live-v3')` sync; dashboard operates independently when detached. |
| **XGBoost / CatBoost / Random Forest** | Implemented (Synthetic) | Calibrated 10-feature inference + SHAP & LIME-style local attribution; advisory only. |
| **LightGBM / MLP / AdaBoost / KNN / Ridge / Lasso** | Research Benchmark Only | Reported transparently in Model Diagnostics under the 11-model Research Paper (3,600 frames) suite; not packaged as runtime predictors. |
| **Loop-Line Overtaking Geometry** | Not Modeled | Explicitly disclosed in AI Dispatch; optimization uses speed regulation, precedence grants, and block holds only. |
| **RailRadar Quota Protection** | Implemented | 12 calls/day, 240/month, max 3 trains/manual fleet refresh, 30-min fresh cache, 7-day stale cache, 1-hr HTTP 429 cooldown, pre-call counting, duplicate suppression. |
| **RailRaksha Intelligence Assistant** | Implemented | Server-side `@google/genai` (`gemini-4-hydrogen`) grounded on structured app context, rate-limited, with deterministic offline fallback. |
| **8-Step Viva Presentation Mode** | Implemented | Zero-quota guided walkthrough across Overview -> Cached 22416 -> Headway Conflict -> Physics/TTC -> SHAP/LIME -> AI Dispatch -> 3D Digital Twin -> Audit Log. |

---

## 4. REST API Endpoint Mapping (`server.ts`)

| Method & Route | Purpose |
| --- | --- |
| `GET /api/health` | Subsystem health, academic scope flags, and RailRadar quota summary. |
| `GET /api/models` | Bundled 3-model (6,480 rows) vs Research Paper 11-model (3,600 frames) benchmarks. |
| `POST /api/predict` | 10-feature kinematic risk classification (`advisoryOnly: true`, `trainedOn: SYNTHETIC`). |
| `POST /api/explain` | SHAP + LIME-style local attributions, top-3 plain factors, and deterministic physics thresholds. |
| `GET /api/scenarios` | 8 interactive controller presets + 36 reproducible synthetic dataset scenarios (seed 25022). |
| `GET /api/live/quota` | Current RailRadar daily/monthly usage, cache hits, duplicate suppressions, and 429 cooldown state. |
| `GET /api/live/watchlist` | All monitored watchlist trains (cached or third-party reported). |
| `POST /api/live/watchlist` | Add any Indian Railways train number to the watchlist (0 external quota used). |
| `DELETE /api/live/watchlist/:trainNo` | Remove a train from the watchlist. |
| `GET /api/live/train/:trainNo?refresh=1` | Fetch fresh cache or execute a single quota-guarded manual refresh. |
| `POST /api/live/fleet/refresh` | Manual batch refresh strictly capped at 3 trains per request. |
| `GET /api/decisions` & `POST /api/decisions` | Read and persist Human-in-the-Loop controller decisions with replay IDs and before/after deltas. |
| `POST /api/assistant` | Context-grounded RailRaksha Intelligence Assistant with deterministic fallback. |
