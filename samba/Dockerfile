FROM alpine:edge

LABEL org.opencontainers.image.title="Samba on Alpine Linux" \
      org.opencontainers.image.description="Patched, minimal Samba file server"

# edge is intentional: Alpine 3.24 still carries Samba 4.23.8, while the
# security fixes published in July 2026 require Samba 4.23.10 or newer.
RUN set -eux; \
    apk upgrade --no-cache; \
    apk add --no-cache \
        'samba-common-tools>=4.23.10-r0' \
        'samba-server>=4.23.10-r0' \
        tini; \
    install -d -m 0755 /config /run/samba /shares /var/lib/samba/private; \
    smbd --version

COPY --chmod=0644 smb.conf /etc/samba/smb.conf
COPY --chmod=0755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

VOLUME ["/config", "/shares", "/var/lib/samba"]
EXPOSE 445/tcp

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD pidof smbd >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["smbd"]
