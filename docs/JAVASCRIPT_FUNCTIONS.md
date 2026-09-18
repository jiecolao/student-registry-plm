# NurSync JavaScript Functions

This document lists the named JavaScript functions defined in `index.html`. The functions use Supabase for authentication, database access, Edge Functions, and realtime updates.

## Utility and Login Functions

### `esc(v)`

Escapes ampersands, angle brackets, and quotation marks before values are inserted into generated HTML. This helps prevent user-provided values from being interpreted as HTML.

### `showLogin(mode)`

Switches the login form between Admin and Student mode. It updates the active tab, changes the login field label and input type, clears the form and error message, and shows the forgot-password link only for admins.

### `syntheticEmail(number)`

Converts a student ID into the internal email address used by Supabase Auth for student accounts. It lowercases the ID, replaces unsupported characters with hyphens, and appends `@students.nursync.internal`.

### `msg(text)`

Displays an error or status message in the main login error area.

### `login(e)`

Handles login form submission. It prevents the normal form submission, reads the credentials, converts a student ID to its synthetic email when necessary, signs in through Supabase Auth, stores the authenticated user, and routes the user according to their role.

### `forgotMsg(text)`

Displays an error message inside the forgot-password modal.

### `resetForgotSteps()`

Resets the forgot-password workflow to its first step. It hides the OTP and password-change steps, clears their fields and errors, and restores the initial instructions.

### `openForgotPassword()`

Opens the forgot-password modal. If needed, it switches the login form to Admin mode, resets the modal, and pre-fills the admin email from the login form.

### `closeForgotPassword()`

Closes the forgot-password modal. If a recovery session is active, it signs that user out and clears `currentUser`.

### `sendAdminOtp()`

Validates the entered admin email and asks Supabase Auth to send a password-recovery message. On success, it stores the email and advances the modal to the OTP step.

### `verifyAdminOtp()`

Validates the eight-digit OTP, verifies it with Supabase Auth, checks that the account has the admin role, and advances to the new-password step. Unauthorized accounts are signed out.

### `changeAdminPassword()`

Validates the new admin password and its confirmation, updates the authenticated user's password through Supabase, signs out the recovery session, closes the modal, and shows a success message on the login screen.

## Authentication and Data Loading

### `routeUser()`

Looks up the authenticated user's role. It hides the login screen, displays the application, loads either the admin dashboard or student profile, sets the role label, and starts realtime subscriptions.

### `loadAdmin()`

Loads all students, document types, and student documents from Supabase in parallel. It stores the results in the application state, fills the graduation-year filter, and renders the student list.

### `loadStudent()`

Finds the student record linked to the authenticated user, loads that student's details and documents, and renders the student profile. It displays an explanatory message if the account is not linked or the record cannot be loaded.

### `refreshData(openStudentId)`

Reloads the students and student documents used by the admin view. It refreshes filters and rendering, while preserving or reopening the relevant student card when an ID is provided.

### `subscribeRealtime()`

Creates a Supabase realtime channel for changes to students and student documents. Admins refresh their dashboard, while students reload their profile when document changes arrive. Any previous channel is removed first.

### `signOut()`

Removes the realtime channel, signs the user out of Supabase, clears the current user, returns to the login screen, and resets the login form to Admin mode.

## Student List, Filtering, and Statistics

### `fillYears()`

Collects unique graduation years from the loaded students, sorts them from newest to oldest, and rebuilds the graduation-year filter while preserving its previous selection.

### `docsFor(id)`

Returns all document records belonging to the student with the specified student ID.

### `stamp(id)`

Calculates the document status shown on a student card. It returns a label such as `3 / 5` and a CSS class indicating whether required documents are complete, partially complete, or unavailable.

### `renderGraduationStats()`

Counts students by graduation year and renders one statistic panel per year. If no graduation-year data exists, it renders a fallback message.

### `documentCompletion(student)`

Calculates the fraction of required document types submitted by a student. It returns a value between `0` and `1`; when there are no required document types, it returns `0`.

### `compareStudents(a, b, sortBy, direction)`

Compares two student records for sorting. It supports sorting by graduation year, name, student number, or required-document completion, and applies ascending or descending order. Missing graduation years are placed after populated years.

### `renderStudents(openStudentId = null)`

Filters students using the search text and graduation-year filter, sorts them using the selected sort options, renders the student cards, updates dashboard counters, and optionally reopens a specific card.

## HTML Rendering Functions

### `studentCard(s)`

Builds the HTML for one admin student card, including the student summary, expandable details, document checklist, edit action, and delete action.

### `detailHtml(s)`

Builds the HTML grid containing a student's identifying information, contact details, addresses, graduation year, and residency year.

### `docRow(s, t, admin)`

Builds one editable document-checklist row for an admin. It shows the submitted state, document name, existing file link, URL input, Save button, and Remove button where applicable.

### `studentDocView(s, t)`

Builds one read-only document row for the student view. It shows whether the document was submitted and provides a link when a file URL exists.

## Card and Modal Interaction Functions

### `toggleCard(id)`

Opens or closes a student card. It closes any other open card first so only one card is expanded at a time.

### `stopCardToggle(e)`

Stops an event from bubbling to the student-card header. This allows controls such as inputs and buttons inside an open card to work without toggling the card.

### `openStudentModal(s)`

Opens the add/edit student modal. It fills the form with an existing student's values when editing, clears password fields, sets the modal title, and displays the modal.

### `closeStudentModal()`

Hides the add/edit student modal.

### `editStudent(id)`

Finds a student in the loaded state and opens the student modal in edit mode.

### `modalMsg(t)`

Displays a validation or save error inside the add/edit student modal.

## Student and Document Management

### `ensureDocs(studentId)`

Ensures that a student has a document record for every configured document type. It inserts missing records without replacing existing ones, then refreshes the admin data.

### `toggleDoc(studentId, typeId, checked)`

Toggles a document's submitted state. It sets or clears the submission timestamp, upserts the record in Supabase, and refreshes the affected student card.

### `saveDoc(studentId, typeId)`

Reads a document URL from the checklist row and saves it. A non-empty URL marks the document as submitted; an empty URL clears the stored URL and submitted state.

### `removeDoc(studentId, typeId)`

Clears a document's URL, submitted state, and submission timestamp without deleting the document record itself.

### `saveStudent()`

Validates the add/edit student form, builds the student payload, inserts or updates the student record, ensures document records exist, and optionally invokes the `create-student-account` Supabase Edge Function when a password was supplied. It then closes the modal and refreshes the dashboard.

### `deleteStudent(id)`

Asks for confirmation and deletes the selected student. Database relationships are expected to remove the associated document records according to the database schema, after which the dashboard is refreshed.

## Initialization

The final script statement calls `sb.auth.getSession()`. If an existing session is found, it sets `currentUser` and calls `routeUser()` so a returning user goes directly to the appropriate view.

## Inline Callback Functions

The file also contains short anonymous arrow functions used as callbacks, including:

- `addEventListener("submit", login)` uses the named `login` function for form submission.
- `Promise.all(...)` coordinates parallel Supabase requests.
- `map`, `filter`, `find`, `some`, and `sort` callbacks transform or inspect students and documents.
- Supabase realtime `.on(...)` callbacks refresh the appropriate view after database changes.
- The `then(...)` callback after `getSession()` restores an existing login session.

These callbacks do not have independent names or reusable application-level responsibilities, so the main reference above focuses on the 39 named functions declared in the HTML.