FROM alpine

RUN apk add --no-cache --virtual .runtime-deps \
        haproxy \
        libcap \
    && setcap cap_net_bind_service+ep /usr/sbin/haproxy

WORKDIR /config
USER haproxy:haproxy
CMD ["haproxy", "-f", "/config/config.cfg"]
