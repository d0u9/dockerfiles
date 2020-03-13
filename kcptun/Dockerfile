FROM alpine as build

RUN apk add --no-cache --virtual .build-deps \
        wget \
    && wget -nv -O - https://github.com/xtaci/kcptun/releases/download/v20200226/kcptun-linux-amd64-20200226.tar.gz \
       | tar -xz

FROM alpine
COPY --from=build /*_linux_amd64 /usr/bin/

RUN apk add --no-cache --virtual .runtime-deps \
        su-exec \
    && mv /usr/bin/server_linux_amd64 /usr/bin/kcp-server \
    && mv /usr/bin/client_linux_amd64 /usr/bin/kcp-client \
    && adduser  -D -H -u 60001 kcp

WORKDIR /config
COPY start.sh /usr/bin/
CMD ["/usr/bin/start.sh"]
