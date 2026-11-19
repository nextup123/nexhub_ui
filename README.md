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

The server address is also shown under the **Sign in** button. Click it to change it (for example to
`http://localhost:4060` for a test hub); the last address that worked is remembered on this computer.

**Render's free plan** puts the hub to sleep after about 15 minutes without use. The first visit then
takes up to a minute; the sign-in screen says it can't reach the hub and keeps trying until it wakes.

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

## Projects

- **Projects** in the menu lists every project with its robots, open problems and last site visit.
- The big search box looks through every project at once: problems, causes, solutions, site-visit reports,
  notes, customers and robot serials. Solved problems come first, with their solution shown.
- A project page has **Overview** (robots, open problems, latest visits, details, team, history),
  **Problems**, **Site visits** and **Notes**, each with its own search.
- **Log a site visit**: the date, who went, what was done, and each problem found that day with how it
  was solved. **Log a problem** for anything found between visits; **Write the solution** when it is fixed.
- Leads and founders create projects, change the team and put robots from the build list on a project.

## Super user

A secret account above Founder, set up on the hub's side with `SUPERUSER_EMAIL` and `SUPERUSER_PASSWORD`
(see the `nextup-hub-api` README). Sign in with it here like any account; it does not appear in **People**.

## What each role sees

The menu only shows what your role allows; the hub checks the same rules on every request
(`src/permissions.js` in `nextup-hub-api`). **Settings → What your role can do** lists them for
whoever is signed in.

## Files

- `src/api.js`: talks to the hub (sign-in token, server address)
- `src/App.jsx`: menu and pages; `src/Login.jsx`: sign-in, setup, change password
- `src/pages/`: one file per page (`Projects.jsx` for projects, problems, site visits and search)
- `src/ui.jsx`: icons, avatars, dates (always in the company's time zone)
- `src/styles.css`, `src/app.css`: same fonts and colours as the website, light and dark
