From nginx:alpine

# Don't need to create our own GROUP and USER, Because they are automatically created.

RUN set -e; \
    apk add --no-cache --virtual .build-deps \
        certbot \
        certbot-nginx \
        chrony \
        supervisor \
        su-exec \
        ; \
    mkdir /runtime ; \
    mkdir /config ; \
    :;

WORKDIR /runtime

COPY supervisord.conf /runtime/
COPY --chmod=744 certbot-install.sh /usr/local/bin/
COPY --chmod=744 certbot-renew.sh /etc/periodic/15min/
COPY docker-entrypoint.sh /usr/local/bin/

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["nginx"]
