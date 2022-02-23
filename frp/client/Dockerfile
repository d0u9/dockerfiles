FROM alpine AS build

ARG TARGETOS
ARG TARGETARCH

ENV VERSION 0.39.1
ENV URL https://github.com/fatedier/frp/releases/download/
RUN : \
    && apk add --no-cache --virtual .build-deps wget \
    && wget -nv -O - ${URL}/v${VERSION}/frp_${VERSION}_${TARGETOS}_${TARGETARCH}.tar.gz     kcptun-linux-${TARGETARCH}-${VERSION}.tar.gz | tar -xz \
    && mv frp_${VERSION}_${TARGETOS}_${TARGETARCH} /output \
    && :

FROM alpine
COPY --from=build /output/frpc /usr/bin/

RUN : \
    && apk add --no-cache --virtual .runtime-deps \
       libcap \
    && setcap cap_net_bind_service+ep /usr/bin/frpc \
    && adduser -D -H frp \
    && :

USER frp:frp

WORKDIR /config
CMD ["frpc", "-c", "/config/config.json"]
