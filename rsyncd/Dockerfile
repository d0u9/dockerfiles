FROM alpine

RUN set -e; \
    apk add --no-cache --virtual .runtime-deps \
        rsync \
        ; \
    mkdir /config ; \
    :;

WORKDIR /config

COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["rsync"]
