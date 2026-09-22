# Software Requirement Specification (SRS)
## Villa Booking Engine & Connectivity API Integration

---

## 1. System Overview & Technology Stack

The objective is to build a high-performance, SEO-optimized, and fully responsive Villa Booking System consisting of a **Public Guest Storefront**, an **Admin Management Dashboard**, and a **Direct Two-Way Integration** with Booking.com via Connectivity APIs.

### 1.1 Technology Stack Selection

| Domain | Technology | Justification |
| :--- | :--- | :--- |
| **Public Frontend** | **Next.js 14+ (App Router)** | Server-Side Rendering (SSR) & Static Site Generation (SSG) for maximum SEO performance. |
| **Admin Dashboard** | **Next.js / Vite + React** | Fast, interactive, single-page application experience for administrators. |
| **Styling & UI** | **Tailwind CSS + Shadcn UI** | Highly customizable, fully responsive grid system with high accessibility. |
| **Interactive Calendar**| **`react-day-picker` / Custom Canvas Calendar** | Fast date range picker with instant state switching and mobile drawer view. |
| **Backend API** | **Node.js (Express / Next.js Route Handlers)** | Asynchronous processing, lightweight webhooks handling, fast response times. |
| **Database** | **PostgreSQL (Prisma ORM)** | ACID compliance, robust transaction locking to eliminate double-bookings. |
| **Async Tasks & Queues**| **Redis + BullMQ** | Handles rate synchronization and Booking.com API push tasks reliably in background worker queues. |
| **Media Hosting & CDN** | **Cloudinary / AWS S3 + CloudFront CDN** | Next-gen image formatting (`WebP`/`AVIF`), dynamic transformations, and low-latency video streaming. |

---

## 2. Functional Requirements (FR)

### 2.1 Public Guest Storefront
* **FR-01: Interactive Availability Calendar**
  * Displays booked, reserved, and available dates clearly.
  * Allows smooth Check-in/Check-out date range selection with real-time price calculations.
* **FR-02: Instant Direct Booking Engine**
  * Multi-step reservation flow: Date Selection $\rightarrow$ Guest Information $\rightarrow$ Payment/Confirmation.
  * Instant inventory updates upon booking completion.
* **FR-03: SEO & Content Optimization**
  * Dynamic metadata generation, OpenGraph tags, and Structured JSON-LD schema (`LodgingBusiness`).
* **FR-04: High-Performance Media Showcase**
  * Video loops and high-resolution photo galleries with lazy loading and adaptive bitrate streaming.

### 2.2 Admin Panel & Operations
* **FR-05: Centralized Multi-Calendar Dashboard**
  * Unified grid view displaying bookings, rates, restrictions, and availability statuses.
* **FR-06: Manual Date Overrides & Rate Management**
  * One-click date blocking and custom seasonal price overrides.
* **FR-07: Reservation Management**
  * View, filter, edit, or cancel reservations from both direct site and third-party channels.

### 2.3 Booking.com Connectivity API Integration
* **FR-08: ARI Push (Availability, Rates & Inventory)**
  * Instant API push to Booking.com when dates are reserved or rates are modified locally.
* **FR-09: Real-time Reservation Webhooks**
  * Secure endpoint receiving instant POST notifications for external bookings made via Booking.com.
* **FR-10: Two-Way Fallback Synchronization**
  * Scheduled background sync (via Redis/BullMQ) to fetch pending reservations and verify API consistency.

---

## 3. Non-Functional Requirements (NFR)

* **NFR-01: Lightning-Fast Media Delivery**
  * All hero images and video loops must load within 1.5 seconds.
  * Automatic image optimization converting source assets to modern formats (`.webp` / `.avif`) dynamically served via CDN edge locations.
* **NFR-02: Fully Responsive Layouts**
  * Mobile-first responsive UI adapting seamlessly to screen sizes from 320px mobile devices to 4K desktop screens.
* **NFR-03: Concurrency & Double-Booking Protection**
  * Atomic database transactions with row-level locks preventing two guests from booking the same date simultaneously.
* **NFR-04: High Reliability & Resilience**
  * Asynchronous processing for external API calls, ensuring the internal website operates gracefully even during external third-party outages.
* **NFR-05: SEO Core Web Vitals**
  * Maintain Largest Contentful Paint (LCP) < 2.5s, First Input Delay (FID) < 100ms, and Cumulative Layout Shift (CLS) < 0.1.

---

## 4. Logical Functional Requirements (LFR Conversion)

To translate raw requirements into system architecture logic, the operations are categorized as follows:

```
                  ┌───────────────────────────────────────────┐
                  │          Public Guest Storefront          │
                  └─────────────────────┬─────────────────────┘
                                        │
                                        ▼
                  ┌───────────────────────────────────────────┐
                  │        LFR-01: Date Selection API         │
                  └─────────────────────┬─────────────────────┘
                                        │
                                        ▼
                  ┌───────────────────────────────────────────┐
                  │    LFR-02: Transaction Lock Processor    │
                  └──────────────┬─────────────────────┬──────┘
                                 │                     │
                                 ▼                     ▼
┌──────────────────────────────────┐                 ┌──────────────────────────────────┐
│  LFR-03: Local Database Commit   │                 │ LFR-04: BullMQ API Push Worker   │
└──────────────────────────────────┘                 └─────────────────┬────────────────┘
                                                                       │
                                                                       ▼
                                                     ┌──────────────────────────────────┐
                                                     │ LFR-05: Booking.com Connectivity │
                                                     └──────────────────────────────────┘
```

### LFR-01: Availability & Rate Query Engine
* **Input**: Requested Date Range (`checkIn`, `checkOut`), Guest Count.
* **Process**:
  1. Query `AvailabilityCalendar` table for any records where `is_blocked = true` or `available_inventory = 0`.
  2. Compute total cost: $\text{Total} = \sum_{d = \text{checkIn}}^{\text{checkOut}} \text{rate}(d)$.
* **Output**: `Available: True/False`, calculated pricing breakdown.

### LFR-02: Double-Booking Atomic Transaction Processor
* **Logic**: Executed during booking creation.
* **Database Command**:
  ```sql
  BEGIN TRANSACTION;
  
  -- Acquire exclusive row lock on affected dates
  SELECT * FROM availability_calendar 
  WHERE date >= '2026-10-01' AND date < '2026-10-05' 
  FOR UPDATE;

  -- Verify availability under lock
  -- Insert reservation record
  INSERT INTO reservations (...);

  -- Update availability count
  UPDATE availability_calendar 
  SET available_inventory = available_inventory - 1 
  WHERE date >= '2026-10-01' AND date < '2026-10-05';

  COMMIT;
  ```

### LFR-03: Asynchronous API Push Worker (Booking.com Sync)
* **Trigger**: Event `RESERVATION_CREATED` or `MANUAL_DATE_BLOCKED`.
* **Process**:
  1. Event payload added to Redis Queue: `BullMQ.add('SYNC_BOOKING_COM', { dates, status })`.
  2. Worker process picks payload and formats XML/JSON payload required by Booking.com ARI endpoint.
  3. POST request sent with exponential backoff retry logic (up to 3 retries).

### LFR-04: Webhook Receiver Logic (Booking.com $\rightarrow$ Direct Site)
* **Trigger**: Incoming HTTP POST to `/api/webhooks/booking-com`.
* **Process**:
  1. Verify cryptographic signature/token from request headers.
  2. Extract reservation details (`external_id`, `dates`, `guest_info`).
  3. Execute atomic database update to mark corresponding dates as unavailable.
  4. Return `200 OK` response to Booking.com within required SLA timeout (< 3 seconds).

### LFR-05: Fast Media Pipeline
* **Process**:
  1. User uploads high-resolution images/videos to Admin Portal.
  2. Cloudinary / AWS S3 trigger auto-optimization pipeline:
     * Convert videos to compressed HLS stream formats (`.m3u8`).
     * Convert static images to modern `.webp`/`.avif` formats with adaptive quality scaling.
  3. Frontend requests media via dynamic CDN URLs with parameter-based dimensions (e.g., `?w=800&q=80`).