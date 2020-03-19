FROM alpine as build

ENV VERSION 20200226
RUN apk add --no-cache --virtual .build-deps \
        wget \
    && wget -nv -O - https://github.com/xtaci/kcptun/releases/download/v${VERSION}/kcptun-linux-amd64-${VERSION}.tar.gz \
       | tar -xz

FROM alpine
COPY --from=build /*_linux_amd64 /usr/bin/

RUN apk add --no-cache --virtual .runtime-deps \
        libcap \
        su-exec \
    && ls /usr/bin/*_linux_amd64 | xargs -n1 setcap cap_net_bind_service+ep \
    && mv /usr/bin/server_linux_amd64 /usr/bin/kcp-server \
    && mv /usr/bin/client_linux_amd64 /usr/bin/kcp-client \
    && addgroup -g 1998 config \
    && adduser -D -H -u 60001 kcp \
    && adduser kcp config

WORKDIR /config
COPY start.sh /usr/bin/
CMD ["/usr/bin/start.sh"]
