FROM alpine as build

ENV FRP_VERSION 0.35.1
RUN apk add --no-cache --virtual .build-deps \
        wget \
        tar \
    && wget -nv -O - https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/frp_${FRP_VERSION}_linux_amd64.tar.gz \
        | tar -xz \
    && cp frp_${FRP_VERSION}_linux_amd64/frp[s,c] /usr/bin/

FROM alpine
COPY --from=build /usr/bin/frpc /usr/bin/frps /usr/bin/

RUN apk add --no-cache --virtual .runtime-deps \
        libcap \
        su-exec \
    && addgroup -g 1998 config \
    && adduser -D -H -u 60003 frp \
    && adduser frp config \
    && setcap cap_net_bind_service+ep /usr/bin/frpc \
    && setcap cap_net_bind_service+ep /usr/bin/frps

WORKDIR /config
COPY start.sh /usr/bin/
CMD ["/usr/bin/start.sh"]
