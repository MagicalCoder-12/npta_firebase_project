# Name Place Thing Animal – Multiplayer Edition (Firebase)

This is a Firebase Hosting–ready project that implements a **real-time multiplayer** “Name Place Thing Animal” game using **Firebase Realtime Database** with **anonymous auth**.

## Features
- Host / Join with 6-char game code
- Live waiting room, players list, presence tracking
- Round-based gameplay with letter + countdown
- Answer submission, host validation (accept / duplicate / reject)
- Live scoring and final leaderboard
- AdSense-ready layout (top banner + sidebar slot)
- Responsive, modern UI (Poppins, gradient cards)
- Respects `prefers-reduced-motion`

## Quick Start
1. Create a Firebase project and enable:
   - **Authentication → Sign-in method → Anonymous**
   - **Realtime Database → Start in Test Mode (for dev)**, then set rules later
2. In `public/app.js`, update the `firebaseConfig` with your project keys.
3. Deploy to Firebase Hosting:
```
npm install -g firebase-tools
firebase login
firebase init hosting   # choose this folder, set public = public
firebase deploy
```

4. Open the site, click **Host Game** or **Join Game** to play.

## AdSense
- Replace the dummy ad code with your real AdSense snippet.
- Ad slots are defined with `.ad-slot.ad-top` and `.ad-slot.ad-sidebar`

## Database Paths
```
/games/{code}/state
/games/{code}/players/{uid}
/games/{code}/answers/{round}/{uid}
/games/{code}/validation/{round}/{uid}
/games/{code}/stats
```

## Notes
- Timer is host-driven to avoid drift. If the host leaves, timing pauses.
- Validation must be completed for all submitted cells before finalizing.
- Scoring: Accept +10, Duplicate +5, Reject +0.
