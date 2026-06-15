# GitHub Publication

## Goal

The repository should present a coherent research prototype:

- clear product boundary,
- English-first engineering documentation,
- synthetic data only,
- testable backend and frontend,
- explicit safety and audit constraints.

## Pre-Publication Checklist

- No real case material.
- No sensitive personal data.
- No secrets, keys, or tokens.
- Tests pass.
- GitHub Actions CI passes on `main`.
- README avoids lie-detection or operational-readiness claims.
- Documentation clearly states that the system is advisory and human-controlled.
- `.gitignore` covers local databases, exports, generated workspaces, and secrets.

## Recommended Repository Policy

Keep the repository private until:

- research scope is approved,
- licensing is decided,
- data policy is finalized,
- public-facing language has been reviewed,
- no internal notes or private assumptions remain.

## Local Git Flow

```powershell
git status
git add .
git commit -m "Describe the change"
git push origin main
```

## Repository URL

Current remote:

```text
https://github.com/BartChmiel/Interrog-A-I-tion
```

## Naming

Use `InterrogA(I)tion` for the product name in public-facing text.

Avoid older spellings or working names.
