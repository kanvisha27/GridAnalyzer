# Grid Analyzer - Simplified DC Power Flow & Contingency Analysis

An educational web app for a network of 2 to 10 buses (substations) joined by transmission lines. You enter generation, demand, line reactance and capacity, pick a reference bus, and the app builds the susceptance matrix, removes the reference bus, solves for voltage angles, computes line flows, flags overloads, and simulates the outage of any one line. Grids, scenarios and results are saved to **Firebase Firestore**.

> **Disclaimer.** This is a simplified DC power-flow approximation for learning. It is **not** a real operational power-grid control, planning or safety system. Do not use it to make real grid decisions.

---

## 1. Overview

### Features

- Dashboard with bus/line counts, total generation and demand, overload count, grid status and latest analysis.
- Grid editor: create, save, load, rename, duplicate, delete grids; add/edit/delete buses and lines; exactly one reference bus; live validation; balance and connectivity checks; sample 6-bus network; network diagram (React Flow).
- Demand/generation **scenarios** (named per-bus overrides) saved per grid.
- Base-case analysis with expandable teaching panels (matrix B, injections, reduced matrix, inverse, angles, adjacency list), a results table sorted by loading, highlighted heavy lines.
- Contingency analysis: remove one line on a temporary copy, re-solve, compare before/after, flag new overloads, handle network splitting.
- Saved results browser (view, restore grid snapshot, delete).
- **Demo mode** (no Firebase needed; data stays in your browser).

### Architecture and data flow

```
React (Vite) ──axios──▶ FastAPI /api/analyze, /api/contingency   (stateless: grid in, results out)
     │
     └──Firebase Web SDK──▶ Firestore (grids, demandscenarios, analysisresults)
```

React holds the grid, sends it to Python, shows the answer, and saves/loads documents in Firestore. The Python server stores nothing.

### Stack

React 18 + Vite (JavaScript), Tailwind CSS 3, `@xyflow/react`, Axios, Firebase Web SDK (Firestore + Anonymous Auth), Python + FastAPI + Uvicorn + Pydantic, pytest. No NumPy/SciPy: all linear algebra is hand-written.

### Directory tree

```
GridAnalyzer/
├── README.md
├── firestore.rules
├── .gitignore
├── backend/
│   ├── main.py                 FastAPI app, CORS, error handlers
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── algorithms/
│   │   ├── linalg.py           Gaussian elimination, Gauss-Jordan inverse
│   │   ├── graph.py            adjacency list, BFS connectivity
│   │   └── dcflow.py           B matrix, reduction, solve, flows, overloads, contingency, merge sort
│   ├── routes/                 health.py, analysis.py
│   ├── schemas/models.py       Pydantic request/response models
│   └── tests/                  test_linalg_graph.py, test_dcflow.py, test_api.py
└── frontend/
    ├── package.json, vite.config.js, tailwind.config.js, postcss.config.js, eslint.config.js
    ├── .env.example, index.html, public/favicon.svg
    └── src/
        ├── main.jsx, App.jsx, index.css
        ├── context/GridContext.jsx
        ├── pages/        Dashboard, GridEditor, Analysis, History
        ├── components/   Layout, UI, GridGraph, MatrixTable, ResultsTable, EditorTables, ScenarioPanel, AnalysisPanels
        └── services/     api.js, firebase.js, storage.js, sampleData.js, validation.js
```

### Units and assumptions

- DC approximation: voltage magnitudes fixed, small angle differences, line resistance and reactive power ignored.
- Everything is **per-unit (p.u.) on one common system base** you choose. The app never prints MW. If you decide 1 p.u. = 100 MW, multiply flows and capacities by 100 yourself. Angles are radians (degrees also shown).
- Net injection at bus i: `P_i = generation_i - demand_i`.
- **Balance required:** total net injection must be 0 (tolerance 1e-6 p.u.). If not, the API returns an `unbalanced` error. Nothing is altered silently. The editor has an optional button that adjusts the reference bus generation when you click it.

### Linear algebra and DSA used

| Item                                                                          | Where                                        |
| ----------------------------------------------------------------------------- | -------------------------------------------- |
| Graph adjacency list                                                          | `graph.build_adjacency`                    |
| Connectivity (BFS)                                                            | `graph.connected_components`               |
| Susceptance matrix B: `B_ii = Σ 1/x`, `B_ij = -1/x` (parallel lines add) | `dcflow.build_susceptance_matrix`          |
| Injection vector P                                                            | `dcflow.net_injections`                    |
| Reference-bus reduction (delete row/column/entry)                             | `dcflow.reduce_system`                     |
| Gauss-Jordan inverse (partial pivoting)                                       | `linalg.gauss_jordan_inverse`              |
| Gaussian elimination, partial pivoting (primary solver)                       | `linalg.gaussian_solve`                    |
| Angles, flows `(θ_from − θ_to)/x`, loading %                             | `dcflow.solve_case`                        |
| Overload status, merge sort by loading                                        | `dcflow.status_for`, `dcflow.merge_sort` |
| Contingency on a deep copy                                                    | `dcflow.run_contingency`                   |

Why remove a bus? Adding the same constant to every angle changes no flow, so the full B is singular (every row sums to 0; the all-ones vector is in its null space). Fixing the reference angle to 0 removes that freedom, and for a connected network the reduced matrix is invertible. Why not use the inverse? Solving `B x = P` directly by elimination needs fewer operations and is more accurate than forming `B⁻¹` and multiplying; the inverse is shown only for study.

Status thresholds: **Normal** below 80% of capacity, **Near limit** 80-100%, **Overloaded** above 100%.

---

## 2. Install the tools (one time)

| Tool                         | Download                            | Notes                                                                             |
| ---------------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| Node.js **LTS**        | https://nodejs.org                  | Accept defaults (includes npm).                                                   |
| Python **3.10 - 3.13** | https://www.python.org/downloads/   | On Windows tick **"Add python.exe to PATH"** on the first installer screen. |
| VS Code                      | https://code.visualstudio.com       |                                                                                   |
| Git                          | https://git-scm.com/downloads       | Accept defaults.                                                                  |
| Firebase account             | https://console.firebase.google.com | Sign in with a Google account.                                                    |

Close and reopen VS Code after installing, then in a VS Code terminal (**Terminal > New Terminal**) verify:

```
node -v
npm -v
python --version        (on Windows you can also use: py --version)
git --version
```

Each prints a version number. If not, see Troubleshooting.

---

## 3. Run the frontend

1. Extract the ZIP. In VS Code choose **File > Open Folder** and open the `GridAnalyzer` folder.
2. Open a terminal and run:

```
cd frontend
npm install
npm run dev
```

`npm install` downloads the packages listed in `package.json`: **react/react-dom** (UI), **react-router-dom** (pages), **@xyflow/react** (network diagram), **axios** (calls the Python API), **firebase** (database and sign-in), **vite** (dev server), **tailwindcss/postcss/autoprefixer** (styling), **eslint** (code checks).
3. Open **http://localhost:5173**. Keep this terminal running; stop it with **Ctrl + C**.

The frontend connects to the linked Firebase project `grid-analyzer-6da28` by default. To use browser-only demo mode, copy `frontend/.env.example` to `frontend/.env`, leave the Firebase values empty, and restart Vite.

## 4. Run the backend

Open a **second** terminal (click the **+** in the terminal panel).

**Windows (PowerShell or Command Prompt):**

```
cd backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**macOS / Linux:**

```
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

- API: **http://localhost:8000**, interactive docs: **http://localhost:8000/docs**, health check: http://localhost:8000/api/health.
- Run `uvicorn` from inside the `backend` folder (it imports `main`).
- Keep **both** terminals running while you use the app. Stop each with Ctrl + C.
- When the venv is active the prompt starts with `(.venv)`. Next time only re-activate it and run `uvicorn`.

**PowerShell says "running scripts is disabled"?** Easiest fix: use **Command Prompt** (`cmd`) and run `.venv\Scripts\activate.bat`. Or allow scripts only for this one window: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` (it resets when you close the terminal). Do not change machine-wide policies.

**Run the tests** (venv active, inside `backend`): `python -m pytest`. **Frontend checks** (inside `frontend`): `npm run lint` and `npm run build`.

---

## 5. Firebase configuration

The linked web app uses anonymous sign-in and the default Firestore database in Mumbai (`asia-south1`). The Firebase CLI project alias is in `.firebaserc`. To connect your own project instead, follow the steps below.

1. Firebase console > **Add project** (Analytics not needed).
2. **Project settings (gear) > General > Your apps > Web (`</>`)**: register an app (skip Hosting).
3. **Build > Firestore Database > Create database**. Choose a region near you and **Production mode**.
4. **Build > Authentication > Get started > Sign-in method > Anonymous > Enable.** (The app signs each browser in anonymously so rules can limit data to its owner.)
5. Back in Project settings, copy the `firebaseConfig` values.
6. In `frontend`, copy `.env.example` to `.env` (Windows: `copy .env.example .env`) and fill in:

| Variable                              | firebaseConfig field                                      |
| ------------------------------------- | --------------------------------------------------------- |
| `VITE_API_BASE_URL`                 | URL of the Python API (default `http://localhost:8000`) |
| `VITE_FIREBASE_API_KEY`             | apiKey                                                    |
| `VITE_FIREBASE_AUTH_DOMAIN`         | authDomain                                                |
| `VITE_FIREBASE_PROJECT_ID`          | projectId                                                 |
| `VITE_FIREBASE_STORAGE_BUCKET`      | storageBucket                                             |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | messagingSenderId                                         |
| `VITE_FIREBASE_APP_ID`              | appId                                                     |

7. Vite only exposes variables that start with `VITE_`. **Stop and restart `npm run dev` after editing `.env`.**
8. **Apply the rules:** Firestore Database > **Rules** tab > replace everything with the contents of `firestore.rules` > **Publish**.
9. **Test:** open the app, load the sample network, click **Save grid**, refresh the page, and the grid should appear under *Saved grids*. The dashboard banner about demo mode disappears.

### Security and authentication

- Authentication **is implemented**: Firebase *Anonymous* Authentication. Each document stores `ownerId` = the browser's uid, and `firestore.rules` allows only that uid to read, change or delete it. Everything else is denied. Never use test-mode rules (`allow read, write: if true`) because they let anyone on the internet read and wipe your database.
- Limits: anonymous identity belongs to one browser profile. Clearing site data, switching browser or device loses access to earlier documents, and nothing can be shared between people. For real accounts, add email/Google sign-in.
- The Firebase web config is not a secret, but your rules are what protect data. **Never put a service-account JSON or private key in the frontend or commit one.** `.gitignore` excludes `.env` and typical key file names.

### Firestore data design

- `grids/{id}`: `ownerId, name, referenceBus, buses[{id,name,generation,demand}], lines[{id,from_bus,to_bus,reactance,capacity}], createdAt, updatedAt`
- `demandscenarios/{id}`: `ownerId, gridId, name, overrides{busId:{generation,demand}}, createdAt, updatedAt`
- `analysisresults/{id}`: `ownerId, gridId, gridName, type('base'|'contingency'), scenarioId, scenarioName, outageLineId, summary{}, lineFlows[], payload(JSON string of full result incl. matrices), gridSnapshot(JSON string), createdAt, updatedAt`

Firestore does not allow nested arrays, which is why matrices live inside the `payload` string.

---

## 6. Using the app

1. **Grid editor > Load sample network** (6 buses, 9 lines, reference B1, balanced at 3.5 p.u.).
2. Edit bus names, generation, demand, and line reactance/capacity. Select the **reference** radio on one bus. Read the *Check before analysing* box: it reports invalid values, imbalance and islands.
3. **Save grid**. Use *Saved grids* to load, duplicate or delete. Rename in the *Grid name* box and save.
4. Optional: add a **scenario** (for example the "Evening peak" sample button), then choose it on the Analysis page.
5. **Analysis > Base case > Run base analysis.** Read the table (sorted by loading; click the Loading header to flip), the diagram, and open the numbered panels to see B, P, the reduced system, the inverse and the angles. **Save result** stores a snapshot.
6. **Line outage tab:** choose a line, **Simulate outage**. The table compares flows and loading before/after; new overloads are red. Try L2 or L3 in the sample: several lines overload. If an outage splits the network you get an explanation and no flows.
7. **Saved results:** view past snapshots, restore their grid to the editor, or delete them.

Sample base case (p.u.): L2 84.5% and L3 81.1% are near limit, nothing is overloaded. Outage of L2 produces 3 new overloads; L6 produces 1 (L8).

---

## 7. Put it on GitHub

1. Create an account at https://github.com, then **New repository** (e.g. `grid-analyzer`; leave "add README" unticked).
2. Check Git: `git --version`. First time only:

```
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

3. Open a terminal at the **project root** (the `GridAnalyzer` folder, not `frontend` or `backend`).
4. Make sure `.gitignore` is there and `.env`, `.venv`, `node_modules` are not going to be committed. After `git add` run `git status` and confirm none of them are listed.

```
git init
git add .
git status
git commit -m "Initial commit: Grid Analyzer"
git branch -M main
git remote add origin https://github.com/YOUR-USER/grid-analyzer.git
git push -u origin main
```

5. The repository URL is the green **Code** button on the repository page (HTTPS tab). If asked to log in, use the browser sign-in window or a **personal access token** (GitHub > Settings > Developer settings > Tokens) instead of your password.
6. **Avoid leaking credentials:** only `.env.example` (empty values) should be committed. If you ever commit a secret, rotate it in Firebase; deleting the file later does not remove it from history.

Push problems: `remote origin already exists` > `git remote set-url origin <url>`. `failed to push / rejected` > the remote has files; run `git pull origin main --allow-unrelated-histories` then push. `Authentication failed` > use a token or the browser login. `src refspec main does not match` > you have no commit yet; run `git commit` first.

---

## 8. Troubleshooting

| Problem                              | Fix                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node`/`npm` not recognized      | Reinstall Node LTS, reopen VS Code/terminal.                                                                                                                                                                  |
| `python` not recognized            | Use `py --version` / `py -m venv`. Or reinstall Python with "Add to PATH" ticked.                                                                                                                         |
| `pip` not recognized               | `python -m pip install -r requirements.txt` (or `py -m pip ...`).                                                                                                                                         |
| venv will not activate               | PowerShell: see the policy note above, or use Command Prompt. Check you are in `backend`.                                                                                                                   |
| Port already in use                  | Stop the older terminal (Ctrl + C) or use another port: `uvicorn main:app --reload --port 8001` and set `VITE_API_BASE_URL=http://localhost:8001`. The frontend port 5173 is fixed; close the other Vite. |
| CORS error in browser console        | Open the app on `http://localhost:5173` exactly. For another origin set `CORS_ORIGINS` (comma-separated) before starting Uvicorn.                                                                         |
| "Cannot reach the analysis API"      | Backend not running or wrong `VITE_API_BASE_URL`. Open http://localhost:8000/api/health.                                                                                                                    |
| Dashboard still says demo mode       | `.env` may contain empty or incomplete Firebase overrides. Remove those overrides to use the linked project, then restart Vite.                                                                             |
| `permission-denied` from Firestore | Rules not published, Anonymous sign-in not enabled, or you changed browser/profile (new uid).                                                                                                                 |
| Reactance / capacity invalid         | Both must be numbers greater than 0.                                                                                                                                                                          |
| "Unbalanced"                         | Generation total must equal demand total; fix values or use the balance button.                                                                                                                               |
| "Disconnected / islands"             | Add lines so every bus is reachable from every other.                                                                                                                                                         |
| "Reduced matrix is singular"         | Normally caused by a disconnected network; check connectivity and that reactances are not extremely small/large.                                                                                              |
| Outage "disconnects the network"     | Expected: that line is a bridge. No flows are shown because they would be meaningless.                                                                                                                        |

---

## 9. Deployment (optional, untested guidance)

- **Frontend:** `cd frontend && npm run build` creates `dist/`, a static site (the app uses hash routing so no rewrite rules are needed). Upload to any static host (Netlify, Vercel, Firebase Hosting, GitHub Pages). Set `VITE_API_BASE_URL` in the host's build settings. Set the `VITE_FIREBASE_*` variables only to override the linked project. In Firebase **Authentication > Settings > Authorized domains** add your site's domain.
- **Backend:** any host that runs Python (Render, Railway, Fly.io, a VM). Install `requirements.txt`; start with `uvicorn main:app --host 0.0.0.0 --port $PORT`. Set `CORS_ORIGINS` to your deployed frontend URL (for example `https://my-app.netlify.app`). Use HTTPS for both.
- **Firestore:** publish `firestore.rules`. The API is public and stateless; consider rate limiting if exposed widely.
