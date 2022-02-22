FROM alpine AS build

ARG TARGETARCH

ENV VERSION 20210922
ENV URL https://github.com/xtaci/kcptun/releases/download
RUN : \
    && apk add --no-cache --virtual .build-deps wget \
    && wget -nv -O - ${URL}/v${VERSION}/kcptun-linux-${TARGETARCH}-${VERSION}.tar.gz | tar -xz \
    && mkdir /output \
    && cp client_linux_${TARGETARCH} /output/kcp-client \
    && cp server_linux_${TARGETARCH} /output/kcp-server \
    && :


FROM alpine
COPY --from=build /output/kcp-client /usr/bin/

RUN : \
    && apk add --no-cache --virtual .runtime-deps \
       libcap \
       iptables \
    && setcap cap_net_bind_service+ep /usr/bin/kcp-client \
    && adduser -H -D kcp \
    && :

USER kcp:kcp

WORKDIR /config
CMD ["kcp-client", "-c", "/config/config.json"]
