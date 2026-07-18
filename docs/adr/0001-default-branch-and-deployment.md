# ADR 0001: Default branch and GitHub Pages deployment

Status: Accepted

Date: 2026-07-18

## Context

ESGMap has an established `master` default branch, repository links that cite that
branch, and a GitHub Pages workflow. Renaming the branch inside a presentation
change would mix repository administration with product-interface work and could
break existing links or deployment assumptions.

## Decision

The default branch remains `master`. Do not rename it in the portfolio-standards
pull request. The GitHub Pages workflow deploys pushes to `master` and continues
to allow manual and scheduled runs. Vite retains its relative base so the same
artifact is valid at the Pages project path and through the approved custom route.

Any future default-branch migration requires a separate operational change with
redirect, branch-protection, Pages, documentation, and integration checks.

## Consequences

- UI work can merge without changing repository identity.
- `.github/workflows/deploy.yml` has one unambiguous push branch.
- Existing `master` permalinks and data-source references remain valid.
- A later migration is possible, but it is explicitly outside this task.
