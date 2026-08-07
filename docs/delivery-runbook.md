# Delivery runbook

This runbook separates fast integration feedback from exhaustive release evidence. It applies to GitHub Actions, protected-branch checks, and Vercel status for this repository.

## Validation lanes

### Focused local work

Run the smallest test that exercises the change while iterating. The studio gallery has a dedicated command:

```bash
npm run test:gallery
```

Before publishing application code to a feature branch, use the applicable lint, build, functional, and visual commands documented in `README.md`.

### Pull requests to `dev` or `integration/*`

The `CI - dev pull request` workflow runs two jobs in parallel:

- lint and production build;
- all functional Chromium scenarios.

`CI dev gate` is the only required GitHub Actions check for this lane. It succeeds only when both jobs succeed. Vercel remains a separate required provider check. The target elapsed time is under 10 minutes under normal GitHub Actions capacity.

The local sequential equivalent is:

```bash
npm run test:gate:dev
```

### Promotions to `main`

The `CI - release` workflow runs the release evidence in parallel:

- lint and production build;
- all functional scenarios in Chromium, Firefox, and WebKit;
- visual regression against the approved Windows Chromium baselines.

`CI release gate` is the only required GitHub Actions check for this lane. Vercel and the protected review remain separate requirements. A 20-to-40-minute release gate can be acceptable because it runs once for an authorized promotion, not once for every small change.

The local sequential equivalent is:

```bash
npm run test:gate:release
```

Both local gate commands force one Playwright worker to match CI. The ordinary focused commands may still use the developer-machine default while iterating.

### Manual validation

`Manual validation` runs the same exhaustive technical evidence on demand, but every job and its result use names that differ from protected checks. A manual run is supporting diagnostic evidence only: it never replaces `CI dev gate`, `CI release gate`, Vercel, or a required review on the current Pull Request head.

## Reading required-check states

- `Expected - Waiting for status to be reported` means GitHub has not received a status with that exact name and allowed provider for the current Pull Request commit. It is not a queued job and it is not a passing check.
- `Queued` or `In progress` means a workflow run exists. Open that run before retrying it.
- `Skipped` is not acceptable for either protected aggregate gate. Each gate runs with `always()` and fails unless every dependency reports `success`.
- A green job from a manual workflow does not satisfy a protected Pull Request gate because its name is intentionally different.

Always compare the Pull Request head and base commits with the remote tips immediately before a protected merge. Old successful runs or runs for another SHA are not release evidence.

## Incident procedure

When required checks remain `Expected`:

1. Confirm that the Pull Request targets the branch handled by the expected workflow.
2. Confirm that the workflow file exists in the Pull Request merge context and that its required gate name exactly matches the ruleset.
3. Inspect GitHub Actions status and the repository Actions page to distinguish a platform incident from a repository configuration error.
4. Confirm that the Vercel status comes from the official Vercel GitHub App.
5. Do not recreate the Pull Request, duplicate the branch, push empty commits, or rename checks during an active provider outage. Those actions add state without restoring missing webhooks or runner capacity.
6. After recovery, synchronize the existing Pull Request once if GitHub did not create a run, then verify the new run against the unchanged head SHA.

For a deterministic failure, reproduce the affected test and browser locally before rerunning the appropriate complete gate. Do not use retries to hide a reproducible failure.

## Performance and reliability review

The scheduled `CI metrics` workflow writes a weekly Actions summary for `CI - dev pull request` and `CI - release`. It reports:

- completed run count;
- median and p95 duration, including queue time;
- failures and cancellations;
- rerun rate;
- failed-job frequency.

Review the report weekly while stabilizing the workflow, then at least monthly. Investigate a dev-gate p95 above 10 minutes, repeated reruns, or the same job failing more than once in the seven-day window. Cancellations caused by a newer commit are tracked separately from failures.

## References

- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
- [GitHub Status](https://www.githubstatus.com/)
