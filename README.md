# PowerPoint Add-in (Vite + React + TypeScript)

This repository contains a PowerPoint taskpane add-in built with Vite, React, and TypeScript.  
It includes Office-specific linting/formatting and scripts to run the add-in locally in Desktop PowerPoint.

---

## Prerequisites

- **Node.js** (LTS recommended)
- A **Microsoft 365 account** (sign-in may be required the first time you run locally)
- Local HTTPS trust (the add-in panel runs under `https://localhost`, so you may be prompted to install dev certificates)

---

## Run the add-in prod deployed 
You can run the add-in in PowerPoint Desktop without running it locally by using the deployed version:


```bash
# sideload into PowerPoint (Desktop) manifest with prod URLs
npm run start:office:prod
```

## How to run locally

You can run the add-in in two ways:

### Option A — Desktop PowerPoint (one-command start)

This starts the Vite dev server and sideloads the add-in into Desktop PowerPoint.

```bash
# installs dependencies first if you haven't
npm install

# start Vite and sideload into PowerPoint (Desktop)
npm run start
```

> On first run you may be prompted to **trust local HTTPS certificates** and/or **sign in** to your Microsoft account. This is expected because Office taskpanes require HTTPS and trusted certificates during development.  
> See **“Try it out”** in the Microsoft quickstart for more details:  
> https://learn.microsoft.com/en-us/office/dev/add-ins/quickstarts/powerpoint-quickstart-yo#try-it-out

If you prefer to start PowerPoint only (when Vite is already running), use:

```bash
npm run start:office
```

This will open desktop PowerPoint and add the add-in from the current `manifest.xml` to you Add-ins list.

### Option B — Vite dev server + manual sideload (Office on the web)

Run the dev server and manually sideload the manifest in **Office on the web**:

```bash
# start Vite only
npm run dev
```

Then follow the official guide to **manually sideload an add-in** (choose the “Office on the web” section):  
https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing#manually-sideload-an-add-in-to-office-on-the-web


> To avoid **CORS** issues during local development, there is proxy configured in `vite.config.ts` that forwards requests from the add-in to `localhost:8000`. If using a different port or host, update the proxy settings accordingly.

---

## Available scripts

| Script | What it does | Notes |
|---|---|---|
| `dev` | Runs the Vite dev server at `https://localhost:3000`. | Use for manual sideload or UI development. |
| `build` | Type-checks (`tsc -b`) and builds production assets with Vite. | Output to `dist/`. |
| `preview` | Serves the production build locally over HTTPS. | Useful smoke test after `build`. |
| `lint` | Runs ESLint on the project. | Office add-in rules are included. |
| `lint:fix` | ESLint with `--fix`. |  |
| `format` | Formats files with Prettier. | Uses `office-addin-prettier-config`. |
| `format:check` | Prettier in check mode. |  |
| `signin` | Sign in to Microsoft 365 for local debugging. | May open a browser window to authenticate. |
| `signout` | Sign out from Microsoft 365. |  |
| `start` | **Desktop**: runs Vite and sideloads the add-in into PowerPoint. | Uses `office-addin-debugging` with `--packager false`. |
| `start:office` | **Desktop**: sideload the manifest only (assumes Vite is already running). | Useful if you run `npm run dev` separately. |
| `stop` | Stops sideloaded add-in for the given manifest. | Cleans up the running sideload session. |
| `validate` | Validates the manifest. | Run this if you change manifest fields. |

> **Note:** At this stage the **manifest is configured for local URLs (`https://localhost`) only**. After deploying static files, the manifest will be updated to production URLs.

---

## Project structure (key files)

```
src/
  taskpane/
    taskpane.html   # taskpane host page (served as /taskpane.html in dev)
    main.tsx        # React entry (renders <App/> on Office.onReady)
  commands/
    commands.html   # ribbon commands host page (served as /commands.html in dev)
    commands.ts     # command handlers (TBD)
manifest.xml        # current manifest (desktop scripts may use this)
```

---

## Troubleshooting

- **HTTPS prompts / certificate trust**: Accept the local developer certificates when prompted. You can also install Office dev certs manually (`npx office-addin-dev-certs install`).
- **Sign-in prompts**: Desktop debugging may require Microsoft 365 sign-in.
- **Sideload cleanup**: If PowerPoint keeps a stale manifest, run `npm run stop`, close PowerPoint, then start again.
- **Ports**: The dev server runs on port `3000` by default; ensure your manifest points to the same host/paths.

---
