# CRM Planner - Sales & Cadence Manager

CRM Planner is a modern, high-performance Customer Relationship Management (CRM) application built using **React 18**, **TypeScript**, **Tailwind CSS**, and **Zustand**. It is tailored for field sales teams, providing tools to streamline relationship tracking, deal pipelines, and salesperson activity compliance.

---

## 🚀 Key Features

* **Interactive Analytics Dashboard:** Real-time metrics for sales targets, pipeline valuations, deal win rates, and recent representative logs.
* **Kanban Deal Pipeline:** A visual, drag-and-drop Kanban board to manage opportunity stages (`qualification` ➡️ `proposal` ➡️ `negotiation` ➡️ `closed-won` ➡️ `closed-lost`).
* **Predictive Cadence Suggestion Engine:** Automatically identifies contacts requiring follow-up based on their Tier classification:
  * *Tier A:* 30-day touchpoint cadence.
  * *Tier B:* 60-day touchpoint cadence.
  * *Tier C:* 90-day touchpoint cadence.
  * It reviews the last combined touchpoint (completed meeting or note) and schedules a suggested draft in the planner.
* **Missed Visit Resilience:** Missed or cancelled meetings automatically schedule suggested rescheduling drafts in the subsequent month.
* **Manager Compliance Matrix:** A calendar-style touchpoint matrix mapping representatives against the days of the month. Fully color-coded by status (Completed, Pending, Overdue reports) with detailed hover tooltips.
* **Calendar Integrations:** Generate custom Google Calendar URLs or download standard `.ics` files for Microsoft Outlook and Apple Calendar.
* **Dual Persistence Layer:** Automatic integration with Google Firebase (Firestore / Auth) if configuration keys are present, falling back to synchronous local storage simulation.

<img width="1905" height="906" alt="image" src="https://github.com/user-attachments/assets/dc7b3862-31a0-49b6-8367-c597832e6767" />

---

## 🛠️ Architecture & Tech Stack

* **Frontend Framework:** React 18 & TypeScript (compiled with Vite).
* **Styling System:** Tailwind CSS.
* **State Management:** Zustand (for clean, decoupled stores).
* **Database & Auth:** Firebase Firestore / Firebase Auth (production) or Local Storage (mock mode).
* **Testing Framework:** Vitest.

---

## 🏁 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
* npm (v9.0.0 or higher)

### Setup & Installation
1. Clone the repository to your local system.
2. Install dependencies:
   ```bash
   npm install
   ```

### Connecting to Firebase (Optional)
If you wish to connect to a live Firebase instance instead of using mock data:
1. Create a `.env` file at the root of the project.
2. Add your Firebase credentials:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
   VITE_FIREBASE_PROJECT_ID=your_project_id_here
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
   VITE_FIREBASE_APP_ID=your_app_id_here
   ```
*If environment variables are missing, the CRM will run automatically in Local Storage Mock Mode.*

### Running the Application
To run the local development server:
   ```bash
   npm run dev
   ```
Open your browser and navigate to the port displayed in the console (typically `http://localhost:5173`).

---

## 🧪 Testing Suite

We use **Vitest** to run automated unit tests verifying the core business algorithms and state changes.

### Running Tests
To execute the test suite:
```bash
npm run test
```

### Test Coverage Highlights
* **useMeetingStore.test.ts:**
  * Verifies calculated client cadences trigger draft meetings exactly when thresholds are crossed.
  * Verifies suggested meetings transition to `pending` upon representative approval.
  * Verifies rejected suggestions are removed.
  * Verifies cancelled meetings trigger next-month reschedule suggestions.
