# UrbanCoop Staff Portal — locked product requirements

## Source and precedence

This document preserves the user's final build brief below as the requirements source of truth. Also reviewed: the Project conversations **Design UrbanCoop Website** and **Build UrbanCoop Portal**, including the receipt-flow approval, final Accounts segmented-control approval, removal of Recent Activity and Quick Access, and the final Home/module exclusions. Later explicit instructions in the final brief supersede older proposals (especially discounts, duplicate Supabase business storage, and one-transaction-at-a-time accounts).

Additional conversation context: receipts do not automatically create Cash In entries; staff record actual payments separately. The locked receipt flow is Create → Preview → Save & Finish → Home / New Receipt. Store the creating staff identity with business records. Accounts may be entered for today or earlier dates.

## Visual reference limitation — not a new approval

The original approved image files were not available in this local project or retrievable conversation attachments. A historical `/mnt/data/urbancoop_pet_boarding_app_mockup.png` reference was found, but not the actual image. Exact visual fidelity is therefore unverified. The implemented UI follows the written cream/green, rounded-card, mobile-first component rules. The current Today at a Glance fields (receipt count and submitted status), mixed-pet control layout, and technical input limits are provisional implementation choices. Do not treat these as superseding the approved mockups; reconcile them when the images are supplied.

## Implementation and configuration handoff

The application is a normal local source project. `README.md` documents setup, configuration, tests, limitations and release checks. Google Sheets is the sole business record store; Supabase handles authentication. A Cloudflare Pages Function verifies staff access and signs calls to a Google Apps Script storage adapter. No credentials, live workbook, staff accounts or deployment have been invented or provisioned.

## Final user brief (preserved in full)

Build the **UrbanCoop Staff Portal** as a production-ready mobile-first web application.

You are working inside the UrbanCoop ChatGPT Project. Before writing code, review the Project conversations, approved UI mockups, pricing rules, workflow decisions, and requirements already established here.

The Project context is the functional and design source of truth.

## Development location

Build the actual application files inside the local folder I have opened for this task.

Do not create this as a standalone ChatGPT Site.

Create a normal source-code project that can later be opened and continued in Codex, committed to GitHub, and deployed to Cloudflare Pages.

Also create:

* `README.md`
* `URBANCOOP_REQUIREMENTS.md`
* `.env.example`

The requirements document should summarize the final locked requirements from this Project so Codex can continue development later without needing access to this conversation.

## Application

This is an **internal staff application for UrbanCoop Pet Boarding**, not a customer-facing website.

Primary device: mobile phones.

The application must therefore be:

* mobile-first
* touch friendly
* responsive
* suitable for Android and iPhone browsers
* still usable on tablets and desktop

Do not redesign the approved screens.

Use the approved UI mockups in this Project as the visual source of truth.

## Core screens

Build:

1. Login
2. Home
3. Create Receipt
4. Receipt Preview
5. Receipt History
6. Daily Accounts
7. Accounts History
8. Profile popup / Logout
9. Loading states
10. Error states
11. Unsaved-change confirmation

Do not add unnecessary modules such as Settings, Boarding Info, Recent Activity, or Quick Access.

## Authentication

Use Supabase authentication.

Staff login should be simple:

* Username
* Password

Profile icon should show:

* username
* Logout

No separate settings page is required.

## Home

Follow the locked Home mockup.

Keep the page simple.

Primary actions:

* Create Receipt
* Daily Accounts

Use the approved Today at a Glance component.

Do not add additional dashboard widgets unless they are already part of the approved design.

## Receipt creation

Use the approved Receipt mobile UI.

Fields:

* Customer Name
* Contact Number — optional
* Pet Type
* Number of Pets
* Pet Name(s)
* Check-in Date
* Pickup Date

If multiple pets are selected, dynamically create the appropriate Pet Name fields.

Calculate the number of boarding nights automatically.

Timezone:

`Asia/Colombo`

Currency:

`LKR`

Display currency as:

`Rs.`

## Dog pricing

### 1 dog

1–3 nights:
Rs. 3,000 per night

4–6 nights:
Rs. 2,500 per night

7–29 nights:
Rs. 2,000 per night

30+ nights:
Rs. 1,850 per night

### 2 or more dogs

1–3 nights:
Rs. 2,500 per dog per night

4–29 nights:
Rs. 2,000 per dog per night

30+ nights:
Rs. 1,850 per dog per night

For three or more dogs, use the same per-dog tier as the two-dog pricing.

Calculation:

Number of dogs × nights × applicable rate

## Cat pricing

### 1 cat

1–3 nights:
Rs. 2,000 per night

4+ nights:
Rs. 1,500 per night

### 2 or more cats

1–4 nights:
Rs. 1,850 per cat per night

5+ nights:
Rs. 1,500 per cat per night

Calculation:

Number of cats × nights × applicable rate

## Mixed dog and cat bookings

Calculate dog and cat charges independently using their respective rate rules.

Then:

Dog total + Cat total = Booking total

Do not create a special mixed-pet rate.

## Discounts

Discount functionality will be supplied later.

Keep pricing logic modular so discounts can be added without rewriting the receipt system.

## Receipt preview

Before saving, show the approved Receipt Preview design.

The final receipt must be clean enough that staff can take a screenshot and send it directly to a customer.

## Receipt ID

Generate unique receipt IDs using:

`UC-YYYYMMDD-###`

Example:

`UC-20260914-001`

The final number increments for receipts created on that date.

Store this ID with the receipt.

## Receipt history

Do not create unnecessary duplicate receipt storage merely for history.

History workflow:

1. User chooses a date.
2. Retrieve receipts stored for that date from Google Sheets.
3. Show:

   * Pet Name
   * Customer Name
   * Receipt ID
   * Total
4. User selects a result.
5. Recreate the receipt from the saved data.
6. Display it using the standard receipt design.

History is read-only.

## Daily Accounts

Follow the approved Accounts design.

At the top:

* Date
* Opening Cash

Use the approved segmented/sliding control:

`Cash In | Cash Out`

Do not show Cash In and Cash Out entry areas simultaneously.

### Cash In

Provide multiple rows immediately.

Each row contains:

* Description
* Amount

Show approximately six blank rows initially.

Allow:

`+ Add More Rows`

### Cash Out

Use the same multi-row design.

Each row contains:

* Description
* Amount

Allow additional rows.

Rows can be removed freely before submission.

Do not force staff to add and save transactions one at a time.

## Daily calculation

Calculate automatically:

`Expected Cash = Opening Cash + Total Cash In - Total Cash Out`

Clearly show:

* Opening Cash
* Total Cash In
* Total Cash Out
* Expected Cash in Hand

Expected Cash in Hand should be visually prominent.

## Account submission

Before saving the final day's accounts, show:

`Once submitted, this day's account record cannot be changed. Do you want to submit?`

Actions:

* Cancel
* Yes, Submit

Once confirmed:

* save the record
* mark the date as submitted
* lock the record
* make it read-only through the normal staff interface

## Accounts History

Allow staff to select a date.

Retrieve that date's account record and show:

* Opening Cash
* Cash In transactions
* Cash Out transactions
* Total Cash In
* Total Cash Out
* Expected Cash
* Submitted status

Submitted days must remain read-only.

## Google Sheets

Use Google Sheets as the business-record storage system.

Create an appropriate structure for:

* Receipts
* Account Days
* Account Transactions

A reasonable structure is:

### Receipts

* ReceiptID
* CreatedDate
* CustomerName
* ContactNumber
* PetType
* NumberOfPets
* PetNames
* CheckInDate
* PickupDate
* Nights
* Rate
* StandardTotal
* FinalTotal

Adjust this structure if mixed pet bookings require a cleaner normalized format.

### Account Days

* AccountDayID
* Date
* OpeningCash
* TotalCashIn
* TotalCashOut
* ExpectedCash
* Submitted
* SubmittedAt

### Account Transactions

* TransactionID
* AccountDayID
* Date
* Type
* Description
* Amount

`Type` must be either:

* IN
* OUT

Do not expose Google service-account credentials or API secrets in browser/client code.

Use an appropriate secure server-side integration layer for Google Sheets.

## Supabase

Use Supabase for authentication and any appropriate secure backend functionality required by the application.

Keep authentication/backend responsibilities separated cleanly from the frontend.

Never expose Supabase service-role secrets to client-side code.

## UX rules

If a user attempts to leave a receipt or Accounts page with unsaved work, show:

`Discard unsaved changes?`

Actions:

* Stay
* Discard

For errors show:

`Something went wrong. Please try again. If the issue continues, contact Admin.`

For loading states use:

`Loading...`

with a small lightweight dog/cat animation consistent with the approved visual style.

## Visual system

Follow the approved UrbanCoop mockups.

Maintain:

* warm cream/light background
* UrbanCoop green
* rounded cards
* large touch targets
* consistent spacing
* clean typography
* consistent icon family
* simple pet-friendly styling
* minimal clutter

Primary buttons:
solid UrbanCoop green

Secondary buttons:
light/white with green border

Danger actions:
red

Disabled actions:
light neutral/grey

Inputs:
rounded with clear labels

Focused inputs:
green border

Errors:
red border with short explanatory text

Keep bottom navigation consistent:

* Home
* Receipt
* Accounts

## Code quality

Keep these areas modular:

* UI components
* authentication
* pricing engine
* receipt calculations
* Google Sheets integration
* accounts calculations
* configuration

Do not hard-code secrets.

Use environment variables and create `.env.example`.

Add validation and useful error handling.

Do not expose raw backend/API errors to staff users.

Create reusable functions for the pricing calculations and add tests for the important rate boundaries.

Test at least:

* 1 dog / 3 nights
* 1 dog / 4 nights
* 1 dog / 7 nights
* 1 dog / 30 nights
* multiple dogs
* 1 cat / 3 nights
* 1 cat / 4 nights
* multiple cats / 4 nights
* multiple cats / 5 nights
* mixed cats and dogs
* Cash In / Cash Out calculations

## Handoff to Codex

Build as much of the working application as possible.

Before completing the task:

1. Make sure the local project builds successfully.
2. Document setup instructions in `README.md`.
3. Put all locked product requirements in `URBANCOOP_REQUIREMENTS.md`.
4. Clearly list any credentials or external configuration I still need to supply.
5. Do not invent credentials.
6. Leave the repository in a clean state so I can open the same folder in Codex and continue development.

If a requirement is already clearly established in the UrbanCoop Project conversation, follow it rather than replacing it with a new design decision.
