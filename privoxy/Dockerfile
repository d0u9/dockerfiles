FROM alpine

RUN apk add --no-cache --virtual .runtime-deps \
        privoxy \
        su-exec \
    && addgroup -g 1998 config \
    && adduser privoxy config

WORKDIR /config
COPY start.sh /usr/bin/
CMD ["/usr/bin/start.sh"]
