FROM alpine:3

ARG DOCTL_VERSION=1.177.0
ARG TARGETARCH

LABEL org.opencontainers.image.title="ops" \
      org.opencontainers.image.description="Emergency DigitalOcean toolbox over SSH, with no credentials inside"

RUN set -eux; \
    apk upgrade --no-cache; \
    apk add --no-cache age bash bash-completion ca-certificates curl jq less openssh-server python3 tmux; \
    adduser -D -u 1000 -s /bin/bash ops; \
    sed -i "s/^ops:!:/ops:*:/" /etc/shadow; \
    rm -f /etc/ssh/ssh_host_*

# doctl ships a static binary per architecture and one checksum file per
# release; the download is checked against it before it is installed.
RUN set -eux; \
    base="https://github.com/digitalocean/doctl/releases/download/v${DOCTL_VERSION}"; \
    tar="doctl-${DOCTL_VERSION}-linux-${TARGETARCH}.tar.gz"; \
    cd /tmp; \
    curl -fsSLO "$base/$tar"; \
    curl -fsSL "$base/doctl-${DOCTL_VERSION}-checksums.sha256" | grep " $tar\$" | sha256sum -c -; \
    tar -xzf "$tar" -C /usr/local/bin doctl; \
    rm -f "$tar"; \
    doctl version; \
    doctl completion bash > /usr/share/bash-completion/completions/doctl

# The root filesystem is read-only at run time, but login names come from the
# mounted list of allowed emails. The account files are therefore links into /run,
# rebuilt by the entrypoint from the copies kept here plus one name per
# email, every one of them uid 1000 sharing the ops home. This runs after
# everything else that needs a working /etc/passwd during the build.
RUN set -eux; \
    mkdir -p /usr/local/share/ops; \
    for f in passwd shadow group; do \
        mv "/etc/$f" "/usr/local/share/ops/$f"; \
        ln -s "/run/ops/$f" "/etc/$f"; \
    done

COPY sshd_config /etc/ssh/sshd_config
COPY profile.sh /etc/profile.d/ops.sh
COPY tmux.conf /etc/tmux.conf
COPY unlocked.bashrc /usr/local/share/ops/unlocked.bashrc
COPY OPBOOK.md /usr/local/share/ops/OPBOOK.md
COPY entrypoint.sh /usr/local/sbin/entrypoint
COPY sbin/ops-principals /usr/local/sbin/ops-principals
COPY bin/ /usr/local/bin/
COPY lib/opslib.py /usr/local/lib/ops/opslib.py

# Host keys live on a volume so the fingerprint survives a new container;
# /etc/ops is where the deployment mounts the CA key and
# the allowed emails; /var/lib/ops/vault holds the encrypted credentials.
VOLUME ["/var/lib/ops/ssh"]

EXPOSE 22/tcp

ENTRYPOINT ["/usr/local/sbin/entrypoint"]
