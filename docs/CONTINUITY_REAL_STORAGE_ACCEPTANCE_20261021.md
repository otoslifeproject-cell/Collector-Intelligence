# Collector Intelligence — real private Storage byte acceptance

21 October 2026 · Europe/London · existing draft PR #2 / branch `continuity/resolver-fixtures-20261020`. Continues `90d6cf8`; tested code `2f93ac12f78501ad8f2f8f7e732fc2348d4456bf`. No restart, main merge, production mutation or manual deployment.

## Verified result

[Actions run 39656056319](https://github.com/otoslifeproject-cell/Collector-Intelligence/actions/runs/39656056319) passes **all five jobs**. Complete logs fetched: resolver 119416493368, application 119416493645, PostgreSQL 119416493688, new real Storage 119416493749, existing Auth/REST/browser 119416493821. **450 named checks PASS**: previous 418 plus 32 genuine Storage byte cases. Existing 163 service assertions, 47 combined archive/sale/static browser cases, strict API compilation, locked install and TypeScript/Vite build rerun successfully. Existing seven labelled original-code defect reproductions remain in the old service count; those are not certification of unsafe original behaviour. Existing bundle/tooling warnings remain non-blocking.

The new independent job refuses non-loopback/unapproved databases and any nonempty database before changing anything. It runs PostgreSQL 17, GoTrue 2.197.0, PostgREST 14.18, Kong 3.9.3 and **real Supabase Storage API 1.81.0** with a disposable file backend. Storage installs its own schema and migrations. No metadata stand-in is loaded in this job; no original-photo row is manually inserted/updated/deleted through SQL. Original application core schema, owner RLS and private bucket migration are used unchanged. The separately marked catalogue guard candidate is installed only in the disposable database for these acceptance cases.

The official Storage initial migration can install platform roles. This job explicitly sets `storage.install_roles=false`, provisions only required isolated permissions, and proves that API authenticator cannot assume postgres. Storage's database owner is not a superuser. No privileged API key is registered at the gateway or given to owner clients; Storage's internal service credentials remain server-side. Only synthetic accounts and independently generated 2×2 PNG fixtures are used, not private collection photographs or inferred object evidence.

| Boundary | Actual evidence |
|---|---|
| Private configuration | Original bucket remains private, 26,214,400-byte limit and original allowed MIME list |
| Owner upload/read/list | Two real PNG uploads via official SDK/HTTP; owner download SHA-256/size/content type/owner match; own listing complete for that folder |
| Anonymous/foreign owner | Upload, download, link minting, overwrite, delete, private-source copy and foreign-destination operations refused without changed originals or stray metadata |
| Copy/update/delete | Authorised scratch copy has exact original bytes; duplicate copy refused; scratch upsert/delete affects only scratch, both originals stay byte-identical |
| Limits | Real unsupported-MIME and over-limit errors checked; no metadata orphan created |
| Public access | Public-style URL cannot access the private bucket |
| Signed links | Owner-minted URL serves exact PNG bytes without API key; tampered signature/substituted path rejected; expired URL rejected while authenticated owner read still works |
| Capability semantics | Valid signed URL also works with another owner's Authorization header: possession is a time-limited bearer capability, not proof of reader ownership |
| Independent owner | Second genuine owner uploads/reads/signs own bytes; first owner cannot read them through owner-authenticated download |
| Catalogue | Approval links the actual original intake paths, preserves photo order/hero, original model objects/manifest/initial snapshot and both byte hashes |
| Idempotence/rollback | Exact approval retry returns the same item without duplicate files; denied photo INSERT rolls back item creation, retains DRAFT and both originals |

Synthetic image receipt: each PNG is 77 bytes. Index 0 SHA-256 `65fb8e5a7ee2b7725468e954aba6b80c75bb07de7631b29816ef21dd400db1ec`; index 1 `ba866821b6a018a9b5c574f32256a9310eb0e99eee94dfb4a0ba06b30fc3dc8b`. These prove transport/storage retention only, not photographic adequacy or evidence about a physical object. Current catalogue RPC links the original paths directly; this does not claim a second permanent-file copy happens in the application.

## Scope and original preservation

This closes the **disposable Storage API byte boundary** previously left open by metadata-only catalogue tests, including the original-retention portion of CI-026 for the current RPC path. The old catalogue fixture remains explicitly labelled metadata-only; it has not been silently promoted to real file acceptance. Owner-authorised scratch overwrite/delete tests do not establish immutable/WORM storage, and the current Storage policies still permit owners to edit/delete their own files. No historical original or real collection file was changed.

Application upload/photo rendering, complete signed-in ItemDetail/catalogue routes, human photo review, image transformations, HEIC decoding, hosted S3/CDN/TLS/Envoy/cache behaviour and revocation guarantees remain separate. Valid signed links are not automatically revoked by sign-out; do not treat link possession as identity. No inference/provider call occurs. This stage changes tests/workflow only, not production application UI, so no new UI screenshot acceptance is claimed. Full-flow application verification is the next independent stage.

## Sources and retained authority

Before changes the existing GitHub draft/head, latest verified Drive handover, startup/no-drift/build sources and full governing v4.0 Master/Evidence Policy were read in the resumed chain. Connected read-only Supabase queries returned the complete canonical bodies, byte-identical to the already fully read frozen fixtures: Master SHA-256 `4237146b7142b62f9bc423fcbbb42d3205899eef67ca8135cf7dc066904292a2` (13,235 characters), Policy `1eeab79c9ac903ff7ca69b6dcf15f9c38a9e2a273698e910c7926dd60e74b7e4` (5,450 characters). Supplied Instructions hash remains `7e8f0c9c0d8f71c6b0e7b8e211bc9774c5c3c58bb409e4be5e624387f70506bf`, the same older copy; reattaching it does not establish the unavailable exact current Instructions previously referenced v4.3. No source approval/activation was inferred.

Official setup/config/Storage RLS/download documentation and changelog were checked. The markdown changelog endpoint was unsupported by the retrieval service; the HTML changelog was read instead. The announced November TLS cipher change concerns hosted APIs, not this loopback HTTP fixture; hosted TLS acceptance is not inferred. Pinned Storage v1.81.0 environment/config/initial migration and supported self-hosted compose/Kong routes were inspected. Source links are retained in the machine receipt, including official Storage source at tag v1.81.0. No paid service/hosted branch was provisioned.

The user's standing authorisation allows bounded non-destructive engineering while archival/source publication gaps remain. No exhaustive archival startup PASS or substitution of older Instructions is claimed. Production database/schema/function/permission/Auth/environment/source/stock/photo/attribution/comparable/sale/Knowledge Brain data remains unchanged. Both SQL candidates remain unapplied. Main remains 052a14d; draft PR stays unmerged. No manual deployment or production promotion.

## Verified archive

[13-file full-log/source evidence ZIP](https://drive.google.com/file/d/1eWxCMVKeqeonV6XpH41Ziqb70r50OL3S/view?usp=drivesdk), ID `1eWxCMVKeqeonV6XpH41Ziqb70r50OL3S`: **99,508 bytes**, SHA-256 `5c960bba0a42159bd4d42a554ec64b85dc96a924a744a4e8e32b0ee66cd9c984`. Contains five complete job logs, tested harness/cases/workflow, original private Storage RLS migration, unapplied catalogue candidate, review diff, machine receipt and per-file manifest. Actual raw Drive bytes equal local archive; metadata size/archive parent, ZIP integrity/13 entries and every member digest verified. Earlier handovers, original source manuscripts, failure archives and reviewed screenshots remain preserved unchanged.

This dated checkpoint is archived separately and kept immutable after exact text/metadata readback. Its ID/digest are recorded in CURRENT_HANDOVER, progress, queue and new-window index. Next safe work: actual application photo upload/render/recovery acceptance on these same disposable services; source publication still needs exact current Instructions and source review.
