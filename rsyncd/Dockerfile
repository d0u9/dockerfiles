FROM alpine

RUN set -e; \
    apk add --no-cache --virtual .runtime-deps \
        rsync \
        ; \
    mkdir /config ; \
    mkdir /runtime ; \
    :;

WORKDIR /runtime

COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["rsync"]
