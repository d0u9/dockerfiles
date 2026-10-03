# Working in dockerfiles

One directory per image. Each holds its `Dockerfile`, a `README.md`, a
`buildx.sh`, and whatever files the image needs. Retired images move to
`99-deprecated/`.

Documentation, comments and commit messages are written in English.

## Privacy: this repository is public

This is a **public repository that anyone can access**. Its source, Git
history, published images, and public build logs must be treated as publicly
accessible. **Never add private, personal, sensitive, or deployment-specific
data**, even temporarily or in encrypted form.

- Never include real names, email addresses, passwords, API tokens, keys,
  certificates containing private identity data, host names, IP addresses,
  physical addresses, locations, account identifiers, or other information
  that identifies users, private infrastructure, or deployments.
- This applies to every tracked file, including documentation, comments,
  examples, tests, fixtures, configuration, screenshots, logs, archives,
  databases, and generated files. Examples and tests use made-up values and
  reserved example domains and addresses.
- Keep deployment configuration and secrets outside the repository. Supply
  them at run time through mounted configuration, secret files, or an
  appropriate runtime secret mechanism. Never bake them into an image.
- Exclude local secrets, private configuration, and runtime data from both Git
  and Docker build contexts using appropriate `.gitignore` and `.dockerignore`
  rules. Ignore rules do not protect files already tracked by Git.
- Never pass secrets through Docker `ARG` or `ENV`, embed them in build
  commands, or expose them in logs. If a build needs credentials, use BuildKit
  secret mounts and ensure no secret reaches build output, caches, or layers.
  Deleting a secret in a later layer does not remove it from earlier layers.
- Before committing or publishing, inspect the diff and files being included
  for privacy leaks. Do not copy real local configuration or user data into
  examples or troubleshooting output.
- If private data is discovered, stop propagating it and alert the user
  without repeating the data. Exposed credentials must be revoked or rotated;
  deleting a file does not remove it from Git history or published artifacts.

## Architectures

Every image is built for both `linux/amd64` and `linux/arm64`, as one
multi-architecture manifest. A new image supports both from its first
release; do not ship an amd64-only image with arm64 "to be added later".

- Download architecture-specific binaries by `TARGETARCH` (or
  `TARGETPLATFORM`), never by a hard-coded arch string.
- Stages that only produce architecture-independent output (a frontend
  build, generated files) run on `--platform=$BUILDPLATFORM`, so they are not
  emulated under QEMU.
- `buildx.sh` and any CI workflow include both `linux/amd64` and
  `linux/arm64` in the `--platform` option; their order does not matter.

## Builds and validation

- Follow each image's existing build and release conventions. Local
  `buildx.sh` scripts publish images with `--push`; inspect them before running
  them, and use a non-publishing build for local validation unless publishing
  is part of the user's request.
- Keep build tooling and generated assets in builder stages where applicable.
  Runtime images contain only what the image needs to run.
- Run checks relevant to the changed image and report any architecture or
  runtime behavior that could not be verified. Keep its documentation in sync
  with changes to configuration, build arguments, and runtime requirements.
