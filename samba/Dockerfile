FROM debian:buster-slim

ENV SMB_CONF_DIR /var/samba
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        samba \
        gosu \
    && rm -fr /var/lib/apt/lists/*
    && mkdir -p "$SMB_CONF_DIR"

COPY start.sh usradmin smb_export smb_import /usr/local/bin
ENTRYPOINT ["start.sh"]

EXPOSE 139 445
CMD ["smb", "start"]
