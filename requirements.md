# CRM Planner - Master Requirements Specification

> [!NOTE]
> **Status: Active Reference.**
> This document consolidates all functional and non-functional requirements for the **CRM Planner** application. The system is built on React, TypeScript, Vite, TailwindCSS, and Zustand, with a dual persistence architecture supporting both Google Firebase Firestore and client-side `localStorage` fallbacks.

---

## 1. Document Overview & Target Architecture

CRM Planner is a modern customer relationship management platform optimized for field sales teams. Its core purpose is to drive active salesperson client touchpoints, track deal progression, and automate contact cadences to ensure client retention.

* **Client Stack:** React 18, TypeScript, Vite, TailwindCSS, Zustand state stores.
* **Database & Auth Stack:** Google Firebase (Firestore and Auth) if configured, with automatic fallback to browser `localStorage` initialized with mock seed data for demo environments.

---

## 2. User Authentication & Role-Based Access Control (RBAC)

### FR-AUTH-01: Authentication Pages & Security
* **Login Form:** A clean authentication page requiring an email and password to log in.
* **Session Persistence:** User auth tokens are cached to preserve active sessions across page reloads.

### FR-AUTH-02: User Roles & Permissions
The system enforces strict role boundaries:
* **Admin / Sales Manager:**
  * View all representative schedules, calendars, and compliance matrices.
  * Access configuration settings (client targets, targets threshold, custom tags).
  * Manage user profiles, update permissions, and activate/deactivate accounts.
  * Download company-wide compliance reports.
* **Salesperson:**
  * Dashboard view displaying individual metrics, targets, and recent logs.
  * View, create, and manage contacts, companies, deals, and meetings assigned specifically to them.
  * Locked filters: Salespeople cannot filter by other representatives' schedules unless explicitly granted permissions.

---

## 3. Contacts & Companies Directory (Functional Requirements)

### FR-DIR-01: Contact Records Management
* **Fields:** First Name, Last Name, Email, Phone, Role, Status (*prospect*, *client*, *inactive*), Cadence Tier (*A*, *B*, *C*), Company ID, Company Name, Assigned Salesperson, Primary Owner, Address parameters (street, suburb, state, country, postcode), and Geolocation coordinates (latitude, longitude).
* **Accountability Constraint:** Every contact must have a designated **Primary Owner** assigned to ensure follow-ups are completed.
* **Search & Filters:** Search by contact name and filter by Tier or Status.

### FR-DIR-02: Companies Directory
* **Fields:** Company Name, Industry, Website, Domain, Phone, Address, Coordinates, and Tags.
* **Relationships:** The system must map and display contacts, deals, timeline notes, and meeting logs under the target company profile page.

---

## 4. Deals Board & Sales Pipeline (Functional Requirements)

### FR-DEAL-01: Kanban Board Layout
* **Visual Stages:** Deals must be organized horizontally in a board displaying columns for each pipeline stage:
  1. **Qualification**
  2. **Proposal**
  3. **Negotiation**
  4. **Closed-Won**
  5. **Closed-Lost**
* **Deal Details:** Cards display name, value, target company, contact name, and assignee.

### FR-DEAL-02: Drag-and-Drop Interaction
* Users must be able to drag deal cards between columns to update stages.
* Drag actions must immediately persist updates to the database/localstorage and recalculate cumulative stage values.

---

## 5. Meetings Calendar & Cadence Suggestion Engine

To solve representative forgetfulness, the CRM features a predictive client cadence manager.

### FR-CAD-01: Tier-Based Cadence Thresholds
* The client cadences are set in **Settings** (default thresholds):
  * **Tier A Contacts:** Must be visited every **30 days**.
  * **Tier B Contacts:** Must be visited every **60 days**.
  * **Tier C Contacts:** Must be visited every **90 days**.

### FR-CAD-02: Suggestion Draft Generation
* **The Algorithm:** For every active contact, the engine checks the date of their last touchpoint (defined as the most recent completed meeting or note created under that contact or company).
* **Behavior:**
  * If the days elapsed since the last touchpoint exceed the Tier's threshold, a **Suggested Meeting** draft card is automatically created in the calendar for the current month.
  * Suggested drafts display a warning context explaining why the meeting is proposed (e.g., *"No touchpoint with Gwynne Shotwell in 45 days (Tier A)"*).
  * Suggestion drafts are client-side previews and do not trigger customer notifications or pollute official schedule calendars.

### FR-CAD-03: Actioning Draft Suggestions
Admins and representatives can action suggested drafts in the planner:
* **Approve:** Fips status from `suggested` to `pending`, locking the meeting into the official schedule.
* **Reject:** Deletes the suggestion draft from the month's view.
* **Bulk Forecast (Generate Next 3 Months Schedule):** An automated process that calculates cadences, projects them into the next three calendar months, and instantiates suggested drafts.

### FR-CAD-04: Auto-Rescheduling of Missed Visits
* **Behavior:** If a scheduled meeting is updated with the outcome **"missed / cancelled"**, the cadence engine automatically schedules a new **Suggested** draft meeting in the following calendar month to prevent clients from falling through the cracks.

### FR-CAD-05: Calendar Exports
Every scheduled meeting dialog must support export links:
1. **Google Calendar:** Launches a calendar creation page in a new window with populated description, title, and formatted dates.
2. **ICS Download:** Generates and downloads a standard `.ics` file for MS Outlook or Apple Calendar compatibility.

---

## 6. Compliance & Visit Reporting Dashboard

Managers analyze touchpoint performance on a dedicated Compliance Dashboard.

### FR-COMP-01: Compliance Metrics (KPIs)
* **Visit Completion Rate:** Calculated as `Completed / (Completed + Pending + Overdue)` for the selected month.
* **Active Accounts Visited:** Unique count of companies/contacts met.
* **Sales Pipeline Value:** Sum value of all open deals assigned to the salesperson/team.
* **Overdue Warnings:** The system must flag any `pending` meeting as **Overdue** if the scheduled time + 1 hour has passed without an outcome being logged.

### FR-COMP-02: Rep Touchpoint Heatmap Matrix
* **Visual Matrix:** A calendar-style grid showing days `1` to `31` for the active month, mapped against each salesperson.
* **Day Cell Color Coding:**
  * **Green (Completed):** Rep completed a visit.
  * **Yellow (Scheduled/Pending):** Rep has a meeting scheduled.
  * **Red (Overdue):** Rep missed a meeting without logging a report.
  * **Default gray:** No meetings scheduled.
* **Tooltip Detail:** Hovering over a cell displays details of all meetings on that day (contact, company, status, outcome, or overdue alerts).

### FR-COMP-03: Compliance CSV Export
* Admins/Managers must be able to export audit logs for the selected month and representative.
* Generates a `.csv` file containing: Date, Time, Representative, Contact, Company, Status, Outcome, System Completed Timestamps, and comments.

---

## 7. Configuration Settings (Functional Requirements)

### FR-SET-01: Settings Configurations
Admins configure standard CRM variables:
* **Target Cadences:** Customize days threshold per Tier (A, B, C).
* **Targets & Currencies:** Set sales targets, local currency symbols, and overdue system thresholds.
* **Outcome Tags:** Manage custom dropdown selections for logged meeting outcomes (e.g. *deal progressed*, *follow-up required*, *introduction*).

---

## 8. Data Storage & Firestore Schema (Target Database Requirements)

The Firestore/LocalStorage databases map to six core tables:

### Collections Schema:
1. **USERS:** `uid`, `email`, `displayName`, `role` (*admin*, *salesperson*), and permissions.
2. **CONTACTS:** `id`, `name`, `email`, `phone`, `role`, `status`, `tier`, `companyId`, `companyName`, `assignedSalespersonId`, `primaryOwner`, address components, `latitude`, `longitude`, `createdAt`, `updatedAt`.
3. **COMPANIES:** `id`, `name`, `domain`, `industry`, `website`, `phone`, `tags`, coordinates, timestamps.
4. **DEALS:** `id`, `name`, `value`, `stage` (*qualification*, *proposal*, *negotiation*, *closed-won*, *closed-lost*), `companyId`, `companyName`, `contactId`, `contactName`, `assignedSalespersonId`, timestamps.
5. **MEETINGS:** `id`, `contactId`, `contactName`, `companyId`, `companyName`, `salespersonId`, `month` (YYYY-MM), `status` (*suggested*, *pending*, *completed*), `outcome`, `comments`, `whyContext`, `scheduledAt`, `completedAt`, `createdAt`, `updatedAt`, `followUpDate`.
6. **NOTES:** `id`, `parentId` (contact/company ID), `parentType` (*contact*, *company*), `text`, `createdAt`.
