# Collector Intelligence — source archive and authenticated browser acceptance

21 October 2026 (Europe/London). Continuation from `043517331ed3fdd6046ac248f9ec927dff67a021` on the existing `continuity/resolver-fixtures-20261020` branch and [draft PR #2](https://github.com/otoslifeproject-cell/Collector-Intelligence/pull/2). Production remains outside the authorised development scope.

## Outcome

The Research source inspector previously fetched only 100 newest rows, discarded older versions per document, and described the resulting imports as controlling instructions. It now provides a read-only, owner-checked archive of every counted stored version, with exact version reads and independently recomputed text hashes. Import order no longer implies approval. Older records and placeholders remain available for inspection.

Latest code: `521382d8a42da50c46fe5447f127448548a4e2dc`.

[Final GitHub Actions run 39518999351](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39518999351) completed SUCCESS in all four jobs. Full job logs were retrieved and their counts checked:

| Job | Named tests/checks | Job ID |
|---|---:|---|
| Resolver/source/runtime/target fixtures | 115 | 118957973483 |
| PostgreSQL 17 integration | 40 | 118957973608 |
| Real HTTP services plus browser | 31 service checks + 14 authenticated component cases + 13 existing layout cases | 118957973536 |
| Application/reader regression | 27 existing + 19 new archive-reader tests | 118957972947 |
| **Total** | **259** | Four successful jobs |

Strict affected-API compilation, clean locked dependency installation and TypeScript/Vite build also pass. Local application/reader tests (46), API compilation, syntax checks and build passed. The existing >500 kB bundle warning remains; CI also reports dependency/action deprecation warnings. Expected permission-denied/race errors in disposable database logs are negative-test evidence, not failed jobs. No paid inference was used.

## Implementation

- `src/lib/canonicalArchive.ts` obtains the principal through SDK getUser, explicitly filters owner_id and retains database RLS as the independent backstop. Metadata is paginated in stable document-key/import-time/ID order with exact counts. Missing counts, partial pages, count changes, duplicate IDs and inconsistent owner/identity metadata fail the whole inventory instead of presenting a partial archive as complete. The 10,000-version review limit fails explicitly rather than silently truncating. REST reads have timeout/abort signals.
- Exact body reads recheck Auth and owner/ID filters, compare the selected key/version/hash identity, and recompute SHA-256 over the unchanged UTF-8 text. Hash mismatches remain visibly unverified; matching hashes on short imports/placeholders do not make them usable instruction sources. No source body or historical row is edited.
- `CanonicalArchivePanel.tsx` replaces the old inspector in Research. The outer panel and document groups start closed; metadata loads only when requested. Users choose an exact version; raw text remains escaped React text, never executed HTML. Hash match, content warnings and archival-versus-approved status are distinct.
- Account changes/sign-out cancel outstanding reads and clear prior owner text/inventory. Same-owner reauthentication preserves the current review instead of clearing it on every SIGNED_IN event. Subscription cleanup and aborted-result guards prevent late updates after disposal.
- Keyboard users can open native disclosures, read a version, receive focus on the text, and close back to the originating Read button. Narrow layouts keep version identity beside Read; import date and full digest remain available with the opened text. No new paid action, approval control or publication button was added.
- Existing paid handlers, source-mode flag, approved-source resolution and publication SQL are unchanged. The archive reader is explicitly not a replacement for the approved runtime reader.

## Genuine browser-to-database verification

Story: an owner signs in → opens the archive → SDK calls pass through Kong → PostgREST enforces owner RLS → all version pages return → the chosen exact body is hash-checked and rendered.

The HTTP CI harness now starts a loopback Vite test entry and Chromium against its existing real GoTrue/PostgREST/Kong/PostgreSQL services. The fixture imports the **actual application component, reader, SDK and stylesheet**. It signs in with the two genuine disposable accounts. It does not load a copy of handwritten archive markup or a fake SDK success response.

Owner A has 110 explicitly synthetic/archive-fixture versions, including 105 comparable-workflow versions and a retained unreadable placeholder. Owner B has five versions. The published approved-source selection remains unchanged despite newer unapproved archive rows. No production credentials or private object photographs are used.

| Boundary | Evidence exercised |
|---|---|
| Browser / Auth | Actual SDK password login through Kong; same-owner reauthentication; account switch; sign-out |
| Browser / REST | CORS and exposed Content-Range; two counted pages for the 110-row archive; no archive request while the panel is closed |
| Data / isolation | PostgreSQL owner RLS; explicit owner filters; forged selected-owner/ID metadata cannot cross accounts |
| Text / integrity | Exact UTF-8/newline digest; preserved placeholder; transport-tampered body visibly flagged |
| UI / recovery | Failed REST inventory shows no partial list; Reload recovers against real services; account changes clear private state |
| UI / accessibility | Native keyboard disclosures, focus transfer/return, narrow-screen version identity and document overflow checks |

Failure/retry and tampered-body browser cases deliberately intercept their specific HTTP responses; they do not alter database source rows. Positive and ownership paths use actual services. The standalone fixture is not part of the production build. Browser requests outside loopback are blocked in these archive tests; no AI provider call is made.

## UX review and correction history

Applied the existing brand/UX standards plus the React review and verification skills. This is AI-assisted source/screenshot review, not independent human design sign-off.

- Starting point: Research → closed Project governance/source archive panel. Primary action is Read; Reload and Close are secondary. First cold exact-version read takes three deliberate selections (open archive, choose document group, read version); subsequent reads within the open group take one. Version choice is preserved rather than silently selecting an authoritative import.
- The default Research surface gains no additional open panels or source requests. Long source text and version lists remain bounded scroll areas behind disclosure. Shared light/dark tokens and existing controls are retained.
- First implementation `3d1b56b` passed all automated checks in [run 39518278638](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39518278638). Downloaded the 16 PNG artifact and matched its SHA-256. Directly viewed 1440px light/dark and 390px-light/320px-dark screenshots. Visual inspection caught a real issue: focusing the mobile Read button panned the table right and hid the selected version name despite no document-level overflow.
- `406e22f` keeps Version and Read together below 620px; imported date and digest remain in the opened document. Tightened actual browser assertions to reject table overflow/panning after Read. [Run 39518782626](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39518782626) passed all four jobs.
- `521382d` also preserves review across same-owner SIGNED_IN events. Its browser regression reauthenticates A, switches to B, loads B's five versions, opens B's text and signs out; stale owner content must clear at both account boundaries.

The former screenshots are preserved separately from the corrected final set. Downloaded final artifact `12309922033`, verified its GitHub digest, and directly viewed final 1440px light/dark plus 390px-light/320px-dark PNGs. Mobile Version/Read now remain visible together without horizontal panning; dates/full digests and long original text remain available in the bounded document section. Desktop retains all columns and the same geometry in both themes. Automated geometry covers 320/390/1100/1440 in both themes; keyboard, recovery, session boundaries and warning states pass.

UX decision: **PASS for this authenticated disposable component flow; CONDITIONAL for the hosted full application**, which still requires separate route/account acceptance. No independent human designer sign-off is claimed.

## Source reconciliation and production limits

Read the supplied startup/instruction/build sources and relevant workflow files. The supplied `01_PROJECT_INSTRUCTIONS.md` has no current version label and SHA-256 `7e8f0c9c0d8f71c6b0e7b8e211bc9774c5c3c58bb409e4be5e624387f70506bf`, matching an older archive variant. It does not supply the previously referenced exact v4.3 manuscript. Supplied Master/Policy bytes also differ from the controlling canonical v4.0 pins; no older attachment replaced those policies. Attached files were not modified.

Read-only Supabase verification still shows 90 canonical rows / 41 keys, no publication-events table and no approved view. The canonical v4.0 Master and Policy stored hashes still match database recomputation. Ledger proposal hash remains `340ced9aa9fcfd1f2b5fecd909fd032d066de0f16998d1ccd10e43111ce6e304`; workflow SQL remains `c019866d911ab31f92b1973e99a491ed58bff39d70a20d7acd1a054367b1e068`.

No production records, Auth users, policies, approvals, source-mode settings, stock, original photos, attributions, comparables or sale outcomes were changed. No SQL proposal was applied to production, hosted branch created, paid inference triggered, PR merged, or manual deployment/promotion executed. GitHub main remains `052a14dbd54a60872240d1c8cca1a5b54c53cda0` with Vercel SUCCESS. Branch code `521382d` also has automatic Vercel SUCCESS. These are separately read status observations, not production-promotion evidence.

This closes authenticated **component** browser acceptance in disposable services. Hosted Envoy/TLS/OAuth/session-persistence configuration, the full signed-in Research route with the owner's operational records, and live paid-model quality remain unverified. No exhaustive historical startup PASS or automatic cross-window learning is claimed.

The exact current Project Instructions and review/publication of the prepared source candidates remain the source-governance boundary. This did not block the independent read-only UI/SDK/browser work. Do not silently substitute archived instructions or use production credentials to repeat tests already proven in disposable CI.

## Archive evidence

Pre-fix browser artifact: GitHub artifact `12309665589`, run `39518278638`, 2,135,540 bytes, SHA-256 `8507621883df7be23a542b6b9067643aa6c523a13bf89d086c9e1f45e2774c71`. [Drive preservation](https://drive.google.com/file/d/1kb3MGTHk2vSeyaTvD_JuNU_sPe9IwRWy/view?usp=drivesdk), ID `1kb3MGTHk2vSeyaTvD_JuNU_sPe9IwRWy`. Actual raw Drive download equals the GitHub ZIP byte-for-byte. ZIP contents/integrity checked. This is intentionally the pre-correction screenshot set.

Previous [gateway/source-review handover](https://drive.google.com/file/d/1vJB2O6-QLORH-iha-p5G6PhO1sj7uOkD/view?usp=drivesdk) and [source-manuscript package](https://drive.google.com/file/d/1rUILRYJ03Qc3WzolR9bgw7vIq6f9qmkq/view?usp=drivesdk) remain preserved. [Final corrected screenshot archive](https://drive.google.com/file/d/1bwmPOsy6nJ_-Z7JlKbZv4VS1y2lLBGs5/view?usp=drivesdk), ID `1bwmPOsy6nJ_-Z7JlKbZv4VS1y2lLBGs5`, contains 16 PNGs (eight actual archive-component views and eight existing layout views). GitHub artifact `12309922033`, 2,129,695 bytes, SHA-256 `daf8533b4bf7150636f0e839e5bf54bd98603a3a1cd2a598ef6f0b0f55f30536`. Raw Drive download equals the original GitHub ZIP byte-for-byte; metadata parent/size and ZIP integrity verified.

This dated checkpoint is also archived separately. Its final Drive ID and exact read-back receipt are recorded in the chronological handover/progress entry, preserving this file unchanged after archival verification.

## Integrity at tested code 521382d

| File | SHA-256 |
|---|---|
| Archive reader | 05175a87dae1adbd0d3b03dc3517ea8516dbdaef0855ba1c221ebb16ed9a9ff2 |
| Archive component | 28ef5c11f97080f65720f3ed2a76941a5fb1bde7d2dc43c8513dd237e8419deb |
| Research page | 77c66c299608a0528593f8faefcce5c4629de8cfb45a2632575e21d10420b94a |
| Stylesheet | 12a70578dea483ff159c552b103835335882975251b3c8d7f5bb1943680cde94 |
| Real-service harness | b86a2479ba4aad9c6ab46cbc9dad3992d942b3bf7c4c3f4d5d6907c19a36ba9c |
| Browser regressions | 4719bd1c75dcfbf7988e7842fe8f061f338e292e57b872fd74190a19fdc12632 |

Next safe work can continue independently on this draft. Live source publication still needs the exact current Project Instructions and review of prepared source candidates; production actions remain excluded. Hosted full-route acceptance must be explicitly scoped to an appropriate environment/account, without a blind paid rerun.
