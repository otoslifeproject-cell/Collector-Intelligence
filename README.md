# Collector Intelligence — Collection OS

A private web application for cataloguing, researching, valuing, managing and selling collectible objects.

The first live workflow is glass, but the schema is category-agnostic.

## What v2 includes
- permanent immutable `CI-000001` style item IDs;
- private Supabase authentication;
- inventory dashboard;
- item intake;
- item record editing;
- independent identification / dating / valuation confidence;
- sale-readiness and specialist-review protection;
- image upload storage;
- comparable-sale data model;
- valuation history;
- research queue;
- sales pipeline;
- contacts/specialist routes;
- listing and sale-outcome tables;
- Knowledge Brain records;
- clean external catalogue view;
- GitHub Pages deployment.

## Repository structure

```text
collector-intelligence-app/
├── .env.example
├── .gitignore
├── README.md
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── .github/
│   └── workflows/
│       └── deploy-pages.yml
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   ├── types.ts
│   ├── lib/
│   │   ├── format.ts
│   │   └── supabase.ts
│   ├── components/
│   │   ├── Confidence.tsx
│   │   ├── ItemCard.tsx
│   │   ├── Sidebar.tsx
│   │   └── StatCard.tsx
│   └── pages/
│       ├── Contacts.tsx
│       ├── Dashboard.tsx
│       ├── Inventory.tsx
│       ├── ItemDetail.tsx
│       ├── Login.tsx
│       ├── NewItem.tsx
│       ├── Reports.tsx
│       ├── Research.tsx
│       └── Sales.tsx
└── supabase/
    ├── README.md
    └── migrations/
        ├── 001_core_schema.sql
        ├── 002_rls_and_storage.sql
        └── 003_catalogue_views.sql
```

## 1. Create the GitHub repository
Create a **new dedicated repo**:

`collector-intelligence-app`

Using the same GitHub account as other projects is fine. Do not put this inside an OTOS repository.

Upload **the contents of this folder** to the repo root.

## 2. Set up the dedicated Supabase project
Follow `supabase/README.md`.

Apply the migrations to the Collector Intelligence project only.

## 3. Add GitHub secrets
GitHub repo → Settings → Secrets and variables → Actions → New repository secret.

Add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Use the new Collector Intelligence Supabase values only.

**Never commit a service-role key.**

## 4. Install locally if wanted
```bash
npm install
npm run dev
```

You do not need to work locally if you use GitHub Pages deployment.

## 5. Enable GitHub Pages
Repo → Settings → Pages → Source → **GitHub Actions**.

Push to `main`. The workflow builds and publishes the site.

## 6. First-use sequence
1. Open the deployed app.
2. Create the owner login.
3. Sign in.
4. Add your first physical object.
5. The database assigns `CI-000001`.
6. Upload photographs.
7. Run Collector Intelligence research in ChatGPT.
8. Write verified identification, evidence, comparables, valuation and sale routing into the item record.
9. Repeat for CI-000002 onward.

## Important architecture rule
- **Internal research record:** exhaustive, evidence-led, includes uncertainty and rejected hypotheses.
- **External catalogue record:** clean presentation-safe object information.
- **Listings:** marketplace-specific sales copy.
- **Sale outcomes:** achieved result, fees and actual net.
- **Knowledge Brain:** reusable verified knowledge outside any individual item.

These must not be collapsed into one text field.

## Recommended next build after first five objects
After the first five real records have been entered, build:
1. image reordering + hero selection;
2. richer evidence/comparable editing screens;
3. one-click marketplace listing packs;
4. PDF catalogue / auctioneer-consideration export;
5. Quick Buy mobile screen;
6. AI write-back endpoint / controlled ingestion;
7. multi-select bulk actions;
8. location / storage management;
9. analytics from actual sale outcomes.
