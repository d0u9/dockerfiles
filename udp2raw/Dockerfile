FROM alpine as build

ENV VERSION 20181113.0
RUN apk add --no-cache --virtual .build-deps \
        wget \
    && wget -nv -O - https://github.com/wangyu-/udp2raw-tunnel/releases/download/${VERSION}/udp2raw_binaries.tar.gz \
       | tar -xz

FROM alpine
COPY --from=build /udp2raw_amd64_hw_aes /usr/bin/udp2raw

RUN apk add --no-cache --virtual .runtime-deps \
        libcap \
        su-exec \
    && ls /usr/bin/udp2raw | xargs -n1 setcap cap_net_raw,cap_net_bind_service+ep \
    && addgroup -g 1998 config \
    && adduser -D -H -u 60004 udp2raw \
    && adduser udp2raw config

WORKDIR /config
COPY start.sh nslookup.awk /usr/bin/
CMD ["/usr/bin/start.sh"]
