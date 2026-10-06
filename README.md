# Rido — Everyday Commute Research Platform

A mobile-first research, problem validation, and early pilot signup platform for the early-stage mobility concept **Rido**. 

This platform is a production-ready system designed to gather behavioral insights, understand commute problems, validate the recurring commute concept, and securely collect pilot participant leads. It features a completely frictionless public survey without user logins and a highly secure Admin Dashboard for researchers to manage data.

---

## 🌟 Key Features

### 1. Frictionless Public Survey Experience
- **No User Login Required:** The survey is completely public. Users do not need to register, use OTPs, or authenticate to submit their responses.
- **One-Question-Per-Screen Engine:** A state-machine-driven survey prioritizing actual behavior. Includes keyboard shortcuts (`1-9` for options, `Enter` to advance).
- **Conditional Logic & Constraints:** Dynamic branching (e.g., past ride-sharing behavior dictates follow-up questions) and multi-select capping (max 3 choices).
- **Interactive UI:** Multi-select chips for intuitive day selection ("Days of Travel"), replacing standard text inputs for better UX and structured data collection.
- **Browser Autofill Support:** State accurately syncs with browser autofill/autocomplete events (Chrome/Safari) using `-webkit-autofill` animation hooks.
- **Auto-saving:** Drafts are saved to `localStorage` to prevent accidental loss on page refresh.

### 2. High-Impact Design System
- Signature Rido yellow (`#FFC700`) on a high-contrast obsidian dark mode (`#0B0C10`, `#12131A`).
- Clean spacing, rounded geometry (`rounded-xl`/`rounded-3xl`), micro-interactions, and accessible typography.
- Mobile-first, fully responsive layout with touch-friendly targets and sticky navigation.

### 3. Secure Admin Dashboard & Authentication
- **Admin Login:** Dedicated admin login modal (accessible from the main site).
- **JWT Authentication:** All sensitive researcher API routes are protected by JSON Web Tokens (JWT).
- **Secure Credentials:** Passwords are hashed using `bcrypt`. Environment variables isolate credentials from the frontend code.
- **Comprehensive CRUD Operations:** The dashboard provides real-time stats, paginated tables for Surveys and Pilot Leads, Search/Filter functionality, and Status updates (e.g., Pending, Reviewed, Completed).
- **Data Protection:** Implements soft-delete logic and toast notifications for a smooth administrative UX. Data is never publicly exposed.

### 4. Structured SQLite Database
- **`survey_responses`:** Captures behavioral responses, timestamps, session IDs, client info, status, and admin notes.
- **`pilot_leads`:** Captures name, email, phone, origin, destination, commute time, travel days (stored as structured JSON), and explicit research consent.
- Easily scalable to PostgreSQL if needed via ORM adaptations.

---

## 📂 Project Structure

```
rido-research/
├── server.py              # Production-ready FastAPI application & REST API (JWT Auth, Endpoints)
├── database.py            # SQLite database schema, CRUD operations, and aggregations
├── test_endpoints.py      # Integration and E2E tests for HTTP routes
├── test_comprehensive.py  # Comprehensive E2E behavioral tests
├── static/
│   ├── css/
│   │   └── style.css      # Custom styling, glow badges, autofill overrides
│   └── js/
│       ├── survey-engine.js # Core survey logic, autofill syncing, chip components
│       └── pilot-modal.js   # Standalone pilot application modal logic
└── templates/
    ├── index.html         # Main public landing page
    ├── survey.html        # Dedicated full-screen survey route
    └── admin.html         # Secure internal researcher portal & dashboard UI
```

---

## 🚀 Running the Application Locally

1. **Install Dependencies:**
   Make sure you have Python 3.9+ installed.
   ```bash
   pip install fastapi uvicorn pydantic python-jose passlib bcrypt slowapi python-dotenv
   ```

2. **Start the Server:**
   ```bash
   python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
   ```

3. **Access the App:**
   - **Public Website:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
   - **Full-Screen Survey:** [http://127.0.0.1:8000/survey](http://127.0.0.1:8000/survey)
   - **Admin Login & Dashboard:** [http://127.0.0.1:8000/admin](http://127.0.0.1:8000/admin)

---

## 🔐 Environment Variables for Production

When deploying to a production environment (e.g., Render, Railway, AWS), configure the following environment variables. The application defaults to secure fallback values for local development if these are not set, but they **must** be set in production.

- `RIDO_ADMIN_PASSWORD`: Your secure admin password for production access.
- `RIDO_JWT_SECRET`: A secure, randomly generated string (min 32 characters) used to sign authentication tokens. 
- `RIDO_JWT_EXPIRE_HOURS`: Token expiration duration in hours. (Default: `8`)
- `RIDO_HIDE_DOCS`: Set to `1` to hide the auto-generated Swagger UI (`/docs`) in production.

---

## 🧪 Testing

The repository contains automated tests for both the endpoints and the behavioral checks to ensure robust submissions and data formatting:

```bash
pytest test_endpoints.py test_app.py test_comprehensive_check.py
```
