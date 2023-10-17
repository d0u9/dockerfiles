FROM alpine

# Don't need to create our own GROUP and USER, Because they are automatically created.

RUN set -e; \
    apk add --no-cache \
        libcap \
        dnsmasq \
        ; \
        setcap cap_net_bind_service,cap_net_admin,cap_net_raw+ep /usr/sbin/dnsmasq ; \
        mkdir /dnsmasq ; \
        chown dnsmasq:dnsmasq /dnsmasq ; \
    :;

USER dnsmasq:dnsmasq
WORKDIR /config

COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["dnsmasq"]

