# Contributing to PermissionDrift

First off, thank you for considering contributing to PermissionDrift! It is through developers and security researchers like you that open-source security software stays resilient and trustworthy.

## Code of Conduct
We are committed to providing a friendly, safe, and welcoming environment for everyone, regardless of experience level.

## How Can I Contribute?
- **Reporting Bugs**: Open an issue using the Bug Report template.
- **Suggesting Features**: Propose new credential providers, Win32 handle optimizations, or visualization ideas.
- **Pull Requests**:
  1. Fork the repo and create your branch from `main`.
  2. If you've added code that should be tested, add tests to `tests/`.
  3. Ensure all tests pass: `python -m unittest discover tests`.
  4. If frontend components were modified, ensure `npm run build` in `frontend/` succeeds.
  5. Submit your PR with a clear description of the problem solved.

## Guidelines
- **Zero Secrets Read**: Never write code that reads or parses secret keys or credentials. Only metadata (`os.stat`) and handle queries are permitted.
- **Fail-Soft**: Any handle inspection or permission error must catch `psutil.AccessDenied` and fail softly without crashing or hanging the scan.
