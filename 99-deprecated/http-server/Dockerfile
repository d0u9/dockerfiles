FROM alpine

ARG UID=3004
ARG GID=3004

RUN set -e; \
    apk add --no-cache \
        npm \
        openssl \
        su-exec \
        ; \
    npm install -g http-server ; \
    mkdir /http_root /runtime /etc/https_cert/ ; \
    :;

WORKDIR /http_root

EXPOSE 8080
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/
COPY --chmod=755 init.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["http-server"]
