## Traceability

- Issue: #
- Base branch:
- [ ] For a PR targeting `dev` or `integration/*`, I manually linked the Issue and PR in GitHub's `Development` section, even if the source branch is already connected to the Issue.
- [ ] I confirmed that the Project card shows this PR in `Linked pull requests`.
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

## Risks

<!-- Note likely risks, edge cases, or why risk is low. -->
