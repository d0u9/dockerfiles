# Working in dockerfiles

One directory per image. Each holds its `Dockerfile`, a `README.md`, a
`buildx.sh`, and whatever files the image needs. Retired images move to
`99-deprecated/`.

Documentation, comments and commit messages are written in English.

## Architectures

Every image is built for both `linux/amd64` and `linux/arm64`, as one
multi-architecture manifest. A new image supports both from its first
release; do not ship an amd64-only image with arm64 "to be added later".

- Download architecture-specific binaries by `TARGETARCH` (or
  `TARGETPLATFORM`), never by a hard-coded arch string.
- Stages that only produce architecture-independent output (a frontend
  build, generated files) run on `--platform=$BUILDPLATFORM`, so they are not
  emulated under QEMU.
- `buildx.sh` and any CI workflow pass
  `--platform linux/amd64,linux/arm64`.

## Public repository

This repository is public, and so are the images built from it. Never commit
real names, passwords, keys, tokens, host names, addresses, locations, or
anything else that identifies the people or machines using an image. Those
come from configuration and secrets mounted at run time. Examples and tests use
made-up values.
