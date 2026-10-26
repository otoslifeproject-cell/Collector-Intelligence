# Collector Intelligence — 10-stage owner acceptance tracker

Updated 2026-10-26. This is a *truth record*, not a feature wish-list or claim of completion.

**Owner acceptance rule:** Mark ACCEPTED only after code is committed, tests pass, preview behaviour is checked with real owner data, and a five-minute object journey works. A READY Vercel build alone is insufficient.

| # | Stage | Status | Acceptance evidence still required |
|---|---|---|---|
| 1 | Foundation and data protection | IMPLEMENTED / NOT OWNER-ACCEPTED | Reconfirm original-photo bytes, access controls, live records and source history after new workflows |
| 2 | Completely new front end | PARTIAL | Replace legacy saved-draft, research, inventory, item detail and selling screens with coherent single-object surface |
| 3 | One Add Item | PARTIAL | New home + sidebar direct to /intake, legacy /new redirects there; real bulk photo intake needs owner test |
| 4 | Google visual matching | BLOCKED / PARTIAL | Lens launch exists, results are NOT automatically ingested; requires compliant visual-search integration or owner-assisted evidence import |
| 5 | Research agents and verification | PARTIAL | Existing server research, evidence protections and functional-form checks; real identification/sold-comps benchmark must pass |
| 6 | One live research screen | PARTIAL | Inline result/ticker committed; not yet fully unified with upload or five-minute benchmark |
| 7 | Save Item and bulk catalogue | PARTIAL | Existing safe catalogue RPC, save option and next-item link; still multi-step, not one click |
| 8 | Sell Item stage | PARTIAL | Direct Sell Item action available from eligible catalogue cards; listing review draft exists but full one-stage seller journey requires acceptance |
| 9 | Bulk eBay listings | PARTIAL | Draft-only CSV serializer and selection UI committed; eBay template/category validation and accepted real Seller Hub import receipt are outstanding |
| 10 | Quality assurance and launch | BLOCKED | Fix CI, owner journey with real objects, timed journey, photo/readback, security and permission acceptance |

## Implementation receipts

- Draft PR: https://github.com/otoslifeproject-cell/Collector-Intelligence/pull/2
- All changes remain draft; no production merge, listing publication or direct paid AI automation was authorised.
- Previous CI failure analysis: the owner-QA screenshot test expected a legacy `.itemCard` on the home screen, removed by redesign. Updated test now targets `.ci-home-feature`, preserving detailed research/sales checks.
- Existing research does **not** autonomously import Google Lens image results. Do not claim otherwise.\n- A held AI intake with uncertain completion locks the full photo/context fieldset; regression coverage updated after simplified layout.\n- Initial eBay export is nonpublishing Draft CSV with user-supplied category IDs. It is not accepted by eBay until an actual upload/import receipt verifies every row.
- Hyacinth forcing vase, uranium/vaseline hypotheses and photo ownership are benchmark requirements, not verified automatic wins.

## Next acceptance priorities
1. CI green on branch including owner-home and test fixes.
2. One coherent upload → provisional identification → verified research → save or sell experience.
3. Actual five-minute owner test on the user's real hyacinth forcing vase and at least four contrasting objects.
4. eBay draft export and platform import verification, without publication.

Do not update any stage to ACCEPTED without an independently inspectable test receipt.
