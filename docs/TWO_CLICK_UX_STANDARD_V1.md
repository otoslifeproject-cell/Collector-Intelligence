# Collector Intelligence — Two-Click UX Standard v1.0
Approved by product owner: 2026-10-14
Status: mandatory design acceptance standard for every screen and new feature.
Subordinate to Master Project Brief and Source & Evidence Policy. Security, evidence controls, actual user consent and required data collection take precedence.

## Core
From any natural starting context (dashboard for global workflows; object page for object workflows), **first click chooses the task; second click executes or opens the result** when the necessary data already exists. Do not count initial sign-in, user typing, image selection, or genuine approval of a destructive/paid action as avoidable UI clicks.
"Two clicks" is a performance target, **not** grounds for inventing inputs or silently authorising expense, publication or evidence promotion.

## Default presentation
- One clear page heading, preferably <=5 words.
- One plain-language status or next recommended action.
- At most two primary action choices prominently displayed; secondary actions in one compact menu.
- Original object photograph / visual identification when available.
- A short confidence/value/route overview; visually quiet, no wall of paragraphs.
- Details, museum leads, previous research, pricing audits, source ledgers, backups, admin settings and Knowledge Brain behind expandable Advanced / Evidence / History groups.
- Avoid repeating the same status, title, or analysis across sections.
- Make outcome state persistent and obvious: Saved / Provisional / Needs check; never call research VERIFIED when independent source checks are absent.
- Allow expert shortcuts: quick global search, one-click open object, primary contextual actions, no forced wizard for known data.
- Always expose a clear way back to the object/action.

## Navigation
Dashboard: current objects with hero photo, short label, action; go directly to object with one click.
Inventory: search/filter without forced separate navigation; click item to open; contextual action within one more click.
Object overview: the single canonical home for that object's identity, provisional research, evidence, valuation, photo, decision and sale routing; one action opens a focused workflow and next action completes it where safe.
Research global: find/select item and open it; global source discovery/advanced tasks kept collapsible, with an item-bound return route.
AI intake / Quick Buy: immediate photo input; result card with buy/pass and maximum price, advanced economics optional.
Sales: primary recommended venue / listing status; generate draft, not publish, unless explicit approval.
Reports: top summary and one action; advanced analytics off by default.
Admin/source ledger: never displayed open by default to ordinary users.

## Verification testing
Maintain workflow click matrix: Starting screen | Goal | Minimum required inputs | Expected clicks | Actual clicks | Exception/rationale.
Cover new and returning users, desktop/mobile and keyboard. Test at least: open owned item, view saved findings, launch research, save museum lead, start quick-buy check, generate listing draft, select selling route, view source details.
Pass: <=2 **avoidable navigation/action clicks** for high-frequency flows and no data loss.
Fail: duplicated action controls, confusing split of one item's research across global and object screens, mandatory large tables before action, technical details expanded by default.
Do not mark as regression-tested without actual signed-in browser evidence.

## Change governance
New pages and features must include UX two-click impact check in docs/CURRENT_HANDOVER.md alongside evidence/source impact, migration/test results, and Vercel state. Do not alter old research or object attribution merely to streamline presentation.
