# FieldOps — Vanilla HTML/CSS/JavaScript + Firebase

A starter field-team admin panel with two roles (`admin`, `employee`), Firebase Authentication, Cloud Firestore and Cloud Storage.

## Features
- Email/password sign-in and role-based navigation.
- Admin can create employee/admin login accounts and manage dealer locations.
- Dealer record includes name, address, latitude and longitude.
- Employee check-in/check-out records use Firestore server timestamps and optionally capture GPS coordinates.
- Dealer distances in kilometres are calculated from the employee's current location (straight-line/Haversine distance); dealer list sorts nearest first after location is acquired.
- Employee visit submission requires a photo, notes are optional, and records GPS coordinates, distance, timestamp and a Firebase Storage photo URL.
- Admin can review the latest visits across the team; employees see their own visits.

## Setup
1. Create a project at https://console.firebase.google.com/.
2. Add a **Web App** and copy its Firebase config.
3. In `app.js`, replace all `YOUR_...` values in `firebaseConfig`.
4. Enable **Authentication → Sign-in method → Email/Password**.
5. Create your first admin in **Authentication → Users → Add user**.
6. In **Firestore Database**, create a document in collection `users` whose document ID is exactly the admin's Auth UID. Fields:
   - `name` (string): your name
   - `email` (string): your admin email
   - `role` (string): `admin`
   - `createdAt` (timestamp): current timestamp (optional)
7. Create/enable **Cloud Firestore** and **Cloud Storage**.
8. Publish the contents of `firestore.rules` in Firestore Rules and `storage.rules` in Storage Rules. Review the rules against your company's policies before production.
9. Serve the folder over localhost or HTTPS. Browser ES modules, camera access and geolocation do not work reliably from a `file://` URL. For example, from this directory run `python -m http.server 8080` and open `http://localhost:8080`. For phones, deploy to HTTPS so camera/geolocation APIs can work.

## Important security and platform notes
- This is a client-only starter; there is no trusted server. Admin user creation uses a secondary Firebase Auth app instance so it doesn't replace the current admin session. If the Auth account is created but writing its Firestore profile fails, remove/fix that orphan account in Firebase Console.
- The first admin profile must be created manually in Firestore. Do not let users choose their own role during public sign-up.
- The supplied rules are a starting point, not a complete production security audit. Add App Check, validate allowed fields/types more strictly, consider attendance/visit immutability, and test all rules in the Firebase Emulator Suite before real use. Queries may require Firestore composite indexes; Firebase will provide a link if one is needed.
- `capture="environment"` asks supported mobile browsers to open the rear camera, but standard web HTML cannot guarantee that gallery uploads are impossible on every device/browser. If camera-only evidence is a strict compliance requirement, use a managed device/native app or a trusted server-side capture/attestation workflow. Browser metadata alone is not proof of a live photo.
- Photo files are limited to 10 MB in the UI and Storage rules. Firebase Storage billing and access policies apply.
- GPS requires user permission and HTTPS (localhost is generally treated as secure). Distance is straight-line distance, not road/travel distance.
- Timestamps are written using `serverTimestamp()`. A record can briefly display “Pending” until the server confirms it.


CLOUDINARY_URL=cloudinary://293971974867338:iu2COz0hBE5eAZgf2fzGXHZ7PDQ@o0eicmjo


iu2COz0hBE5eAZgf2fzGXHZ7PDQ
293971974867338