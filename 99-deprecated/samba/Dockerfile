FROM alpine

    # apk --no-cache --no-progress add bash samba shadow tini tzdata;

RUN set -e; \
    apk add --no-cache \
        samba \
        shadow \
        ; \
    mkdir /runtime ; \
    mkdir /config ; \
    :;

WORKDIR /runtime

COPY --chmod=755 init.sh /runtime/
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/
EXPOSE 139 445
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["smbd"]
