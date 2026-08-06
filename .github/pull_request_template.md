## Traceability

- Issue(s): #
- Base branch:
- [ ] Every related Project card is backed by its GitHub Issue, not a draft item.
- [ ] For a PR targeting `dev` or `integration/*`, I included `Refs #<issue>` for every related Issue; no manual `Development` link is required.
- [ ] For a PR targeting `main`, I included `Closes #<issue>` for each completed Issue.

## Summary

<!-- Describe the result of the change, not the implementation history. -->

## Scope

- Included:
- Excluded:
- Source of truth:
- Base branch:
- Head commit at final verification:
- Base commit at final verification:
- Integration or publication dependencies:

## Delivery impact

<!-- Select exactly one. For a mixed promotion, select the most restrictive included classification. -->

- [ ] Repository-only
- [ ] Preview-only
- [ ] Production-eligible
- [ ] Pending decision

## Branch gate

- [ ] For `dev`: every included change is authorized to participate in the next promotion to `main`.
- [ ] For `integration/*`: this branch is used only for pre-`dev` validation and will not target `main`.
- [ ] For `main`: the complete `main...dev` difference and every included Issue are authorized; the recorded head and base commits still match the remote branch tips.

## Validation

<!-- List only checks and manual verification that were actually performed. -->

- [ ] `git diff --check`
- [ ] Relevant lint, build, or tests
- [ ] Manual verification, if applicable
- [ ] For `dev` or `integration/*`: `CI dev gate` and Vercel are green on the current Pull Request head.
- [ ] For `main`: `CI release gate`, Vercel, and the required review are green on the current Pull Request head.
- [ ] Any manual workflow run is recorded only as supporting evidence, not as a replacement for a protected gate.

## Risks

<!-- Note likely risks, edge cases, or why risk is low. -->
