# **Project Specification: "Zero-Latency" Local-First Task Manager**

## **1\. Executive Summary**

A high-performance, local-first task management web application designed to replace "slow" cloud-centric tools like Notion. The application prioritizes **zero-latency** interactions and robust **offline capabilities** while maintaining seamless cross-device synchronization through a "local-data-as-primary" architecture.

## **2\. Core Philosophy: Local-First**

* **Offline-In, Sync-Out:** All user interactions (create, edit, delete) happen instantly against a local database (IndexedDB).  
* **Zero-Latency UI:** The interface updates at the speed of local hardware without waiting for server round-trips or showing loading spinners.  
* **Data Ownership:** Primary data resides on the user's device, using the cloud solely for backup and relay.

## **3\. Technical Stack (Finalized)**

| Layer | Technology | Rationale |
| :---- | :---- | :---- |
| **Frontend** | **Next.js (App Router)** | Industry standard; excellent for PWA integration. |
| **Local Database** | **RxDB** | Reactive, NoSQL local-first engine with conflict resolution. |
| **Backend/Sync** | **Cloud Firestore** | Acts as the "Sync Server" via RxDB replication. |
| **Authentication** | **Google Auth** | Seamless login using existing Google subscriptions. |
| **Deployment** | **Firebase Hosting** | Free, global, and SSL-certified on the **Spark Plan**. |

## **4\. Architecture & Data Flow**

1. **Local Store:** New data is written to the browser's IndexedDB via RxDB.  
2. **Reactive UI:** The frontend "subscribes" to RxDB queries, updating the UI immediately upon local write.  
3. **Background Replication:** A worker detects local changes and pushes them to Firestore when online.  
4. **Multi-Device Sync:** Firestore pushes updates to other authenticated devices for local merging.

## **5\. Entity-Linked Data Schema**

All IDs must be generated as **UUIDs (v4)** locally to ensure collision-free offline creation.

### **A. Tasks (Core Entity)**

* **id:** string (Primary Key, Hidden).  
* **description:** string (Required, Single-line).  
* **details:** rich-text/markdown (Optional; supports links).  
* **date\_created:** timestamp (Auto-assigned; Required).  
* **show\_on:** date (Optional; hides task until this date).  
* **action\_date:** date (Optional; for future calendar use).  
* **project\_id:** string (Optional link to **Projects**; Single-select).  
* **person\_id:** string (Optional link to **Person**; Single-select).  
* **context\_ids:** string\[\] (Optional links to **Context**; Multi-select).  
* **processed:** boolean (Default: false; determines "Inbox" status).  
* **urgency:** enum (Highest, High, Medium, Low).

### **B. Projects**

* **id:** string (Primary Key).  
* **name:** string (Required).  
* **details:** rich-text/markdown (Optional).  
* **status:** enum (**Ongoing**, **Closed**).

### **C. Person & Context**

* **id:** string (Primary Key).  
* **name:** string (Required).

## **6\. Relational Logic & Constraints**

* **The Inbox Rule:** New tasks default to processed: false and appear in the Inbox until manually toggled to true.  
* **Reactive Filtering:** RxDB maintains live queries for views:  
  * **Inbox:** processed \== false.  
  * **Available:** processed \== true AND (show\_on \<= today OR show\_on \== null).  
* **Rich Text:** All details fields must use a lightweight Markdown editor (e.g., **TipTap**).

## **7\. UI Sections & Navigation**

The app features a **Global Navbar** for instant navigation.

### **A. Home (Quick Entry)**

* **Primary Action:** A large, auto-focused input field at the top.  
* **Attributes:** Three select menus (Context, Project, Person) directly below the input.  
* **Logic:** Clicking "Create" writes a new task to RxDB with processed: false.

### **B. Inbox (The Review Queue)**

* **View:** Vertical list of tasks where processed \== false.  
* **Interaction:** Open tasks to add details or toggle the **"Mark as Processed"** button to move them into the main system.

### **C. All Tasks (Master Archive)**

* **View:** List of all tasks with a persistent filter bar (Context, Person, Project).

### **D. Contexts & Persons (Visual Browsing)**

* **Layout:** A grid of large, clickable tiles.  
* **Logic:** Clicking a tile navigates to the **All Tasks** page with that entity filter pre-applied.

### **E. Projects (Deep Dive)**

* **List View:** Filtered by "Ongoing" status by default.  
* **Project Overview:** A two-tab interface for:  
  1. **Tasks:** All tasks linked to the project.  
  2. **Description:** Rich text details and the status toggle.

## **8\. Technical UI Requirements**

* **State Management:** Use RxDB observables ($) for real-time UI updates across devices.  
* **PWA:** Include manifest.json and a service worker for installation and offline UI access.  
* **Cost Strategy:** Use **Firebase Spark Plan** (50k reads/20k writes daily as of 2026\) to keep hosting free.
