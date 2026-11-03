# Version 0.5.0 update delivery verification

Verified November 3, 2026.

- 70 automated tests passed locally and in GitHub Actions. Syntax, manifest,
  permission boundaries, theme compilation and ZIP contents checks passed.
- [Extension CI](https://github.com/pedropizarrojr/money-never-sleeps/actions/runs/41723131958)
  and the first [automatic theme publication](https://github.com/pedropizarrojr/money-never-sleeps/actions/runs/41723131706)
  completed successfully on main commit `5ce14cff1f59a5c0d85765d45a6a2a4e367db30e`.
- All 22 source/documentation/download files in that change were compared to
  their GitHub blob hashes and matched the local tested files.
- Published theme revision `1793741724428` targets extension `0.5.0`. Its 27 HubSpot,
  25 LinkedIn and 28 Google rules exactly matched the locally compiled source.
- The fixed raw GitHub endpoint was opened in the user's Chrome browser. The
  resulting page contained the expected version, revision and three app groups.
  The successful workflow UI was captured in `theme-channel-published.jpg`.
- The ZIP is 62,055 bytes. SHA-256:
  `bf200fcd588bdc35c5bd3e3aab9287e2916c84a93d026c443955cf58dd88f3da`.

The new extension was not installed or reloaded in Chrome in this task. Extension
management access had been blocked earlier, and that restriction was respected.
The raw endpoint check is not a live extension/service-worker integration test.
The client and worker tests use synthetic DOM/network harnesses. Installed-version
mode switching, updater popup layout and download/application behavior still need
a live check after the one-time 0.5.0 update. No Chrome latency measurement or
100–200 ms performance claim is made.

GitHub reported non-blocking notices about older action runtime targets and the
Ubuntu runner image transition. Both workflows completed successfully.
