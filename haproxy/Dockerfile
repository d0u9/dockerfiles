FROM alpine

RUN apk add --no-cache --virtual .runtime-deps \
        haproxy \
        libcap \
        su-exec \
    && addgroup -g 1998 config \
    && adduser haproxy config \
    && setcap cap_net_bind_service+ep /usr/sbin/haproxy

WORKDIR /config
COPY start.sh /usr/bin/
CMD ["/usr/bin/start.sh"]
