# Nextup company dashboard

The screens of the Nextup company hub: home, projects (robots on site, problems and solutions, site visits),
production (robots and their build stages), bug reports,
website enquiries, attendance, leave, calendar, people and your account. It runs on your own computer
and talks to the hub API (`nextup-hub-api`) on Render. Nothing here needs to be online.

React 18 + Vite 5. Needs Node 18 or newer.

## Run it

```bash
npm install
cp .env.example .env.local      # then put your Render address in it
npm run dev
```

`.env.local`:

```
VITE_HUB_URL=https://<your-service>.onrender.com
```

It opens on http://localhost:5174. Sign in with your hub account. The first time, with no accounts yet,
it shows **Set up the hub**: paste `SETUP_KEY` from Render → Environment to create the founder account.

`.env` works too. The file is read when `npm run dev` starts, so stop it (Ctrl+C) and start it again
after changing the address.

The server address is also shown under the **Sign in** button. Click it to change it (for example to
`http://localhost:4060` for a test hub); the last address that worked is remembered on this computer
until `VITE_HUB_URL` is changed.

**Render's free plan** puts the hub to sleep after about 15 minutes without use. The first visit then
takes up to a minute; the sign-in screen says it can't reach the hub and keeps trying until it wakes.

## Android app

The same screens as a phone app you can hand out as an APK, with the hub address built in and hidden.
See **ANDROID.md**.

## Without the Vite dev server

```bash
npm run build      # makes dist/
npm run preview    # serves dist/ on http://localhost:5174
```

`dist/` is plain files, so it can also be opened from any static file server on your network.
`VITE_HUB_URL` is read when building, so build again after changing it (or change the address on the
sign-in screen).

## Try it with sample data, no Render needed

In the `nextup-hub-api` folder: `SEED=1 node test/serve-fake.js` (an in-memory hub on port 4060 with a
sample company). Here: set `VITE_HUB_URL=http://localhost:4060` and `npm run dev`. Everyone's password
is `nextup-demo`:

| Sign in as | Role |
|---|---|
| `dhirendra@nextup.demo` | Founder |
| `meena@nextup.demo` | HR |
| `anil@nextup.demo`, `neha@nextup.demo`, `rohit@nextup.demo` | Lead (Production, Software, Sales) |
| `ravi@nextup.demo`, `imran@nextup.demo`, `pooja@nextup.demo`, `arjun@nextup.demo` | Employee |

## Clients and projects

- **Clients**: every company, with its projects, the robots on them (and the software each runs), the
  conveyors, SPMs and other equipment, and the people to talk to. Each client page has its own search.
- **Projects** in the menu lists every project grouped by client (or **All cards**), with its robots,
  equipment, open problems and last site visit. A new project picks its client, or types a new one.
- A project page shows its **robots** (with software version; update it with the ↻ button, or add a robot
  that was already on site before the hub) and its **equipment** (conveyor, SPM, gripper, vision…).
- When logging a problem, give the **error codes** (E131, AL-21), the part, the robot or equipment and the
  software version. Codes typed in the text are offered as chips. A **Seen before** box shows solved
  problems like it from every project, with their solution, while you type.
- Search finds error codes in any spelling: `e-131` finds `E131` and `E 131`.
- The big search box looks through every project at once: problems, causes, solutions, site-visit reports,
  notes, customers and robot serials. Solved problems come first, with their solution shown.
- A project page has **Overview** (robots, open problems, latest visits, details, team, history),
  **Problems**, **Site visits** and **Notes**, each with its own search.
- **Log a site visit**: the date, who went, what was done, and each problem found that day with how it
  was solved. **Log a problem** for anything found between visits; **Write the solution** when it is fixed.
- Leads and founders create projects, change the team and put robots from the build list on a project.

## Assets: a tag on every part (1.11)

Needs `nextup-hub-api` 1.11.0. Each project has an **Assets** tab: add the project's components (a panel,
the robot arm, the computer), then press **+ Part** on a component to take parts from the store (the stock
from the inventory app). Each part gets its own tag (`NX-000123-K`), or one tag for a lot of nuts or bolts.
Components can hold components (robot arm › joint J1 › motor, bolts). From the tab: **Bill of materials**
(Excel) and **Labels** (A4 sheet of QR labels to print and stick on).

**Assets** in the menu finds anything by its tag: type it, in any spelling, or scan a printed label and
press Enter. An asset's page shows where it is (project › panel › …), what is inside it and everything
that happened to it, and lets you edit, move (an assembly takes its parts along), return to the store
(the number goes back into the stock) or mark it faulty. Founders, leads and employees can do this;
deleting a tag made by mistake is for founders.

## Live updates and alerts

Pages update by themselves when anyone changes something (the dot next to the logo is green while connected).
New website enquiries and bug reports pop up for the roles that may see them; **Settings → Alerts** turns on
desktop notifications and, for founders, shows the Telegram set-up (chat id finder and a test).

## Super user

A secret account above Founder, set up on the hub's side with `SUPERUSER_EMAIL` and `SUPERUSER_PASSWORD`
(see the `nextup-hub-api` README). Sign in with it here like any account; it does not appear in **People**.

It also gets **Bulk import**: pick what you are adding (people, clients, projects, robots, equipment, past
problems), download the CSV template, fill it in Excel or Google Sheets, save as CSV, upload it (or paste
the rows), press **Check every row**, then **Import**. Rows with a problem can be downloaded to fix and
import again. New people's temporary passwords are shown once and can be downloaded as CSV.

## What each role sees

The menu only shows what your role allows; the hub checks the same rules on every request
(`src/permissions.js` in `nextup-hub-api`). **Settings → What your role can do** lists them for
whoever is signed in.

## Files

- `src/api.js`: talks to the hub (sign-in token, server address)
- `src/native.js`, `android/`, `ANDROID.md`: the Android app
- `src/App.jsx`: menu and pages; `src/Login.jsx`: sign-in, setup, change password
- `src/pages/`: one file per page (`Projects.jsx` for projects, problems, site visits and search,
  `Clients.jsx`, `Import.jsx` for the bulk import)
- `src/records.jsx`: error codes, "seen before", equipment kinds, robot software forms
- `src/ui.jsx`: icons, avatars, dates (always in the company's time zone)
- `src/styles.css`, `src/app.css`: same fonts and logo blue as the website, softer contrast, light and dark
