FROM alpine as builder


ARG TARGETPLATFORM
ARG BUILDPLATFORM


# Note: ${TARGETPLATFORM} will be `linux/amd64`
#       ${TARGETPLATFORM//\//_} will replace `/` with `_`

RUN set -e; \
    apk add --no-cache \
        wget \
        tar \
        bash \
        jq \
        curl \
        ; \
    tag=$(curl -s https://api.github.com/repos/fatedier/frp/releases/latest | jq .name -r); \
    echo "$tag"; \
    version=$(bash -c "echo ${tag:1}"); \
    pkg="frp_${version}_${TARGETPLATFORM//\//_}.tar.gz"; \
    wget -nv -O - https://github.com/fatedier/frp/releases/download/${tag}/${pkg} \
        | tar -xz; \
    cp frp_${version}_${TARGETPLATFORM//\//_}/frp[s,c] /usr/local/bin/; \
    :;

FROM alpine
COPY --from=builder /usr/local/bin/frpc /usr/local/bin/frps /usr/local/bin/

ARG UID=3004
ARG GID=3004

RUN set -e; \
    apk add --no-cache \
        libcap \
        ; \
    addgroup -g ${GID} frp; \
    adduser -D -H -G frp -u ${UID} frp; \
    setcap cap_net_bind_service+ep /usr/local/bin/frpc; \
    setcap cap_net_bind_service+ep /usr/local/bin/frps; \
    :;

USER frp:frp
WORKDIR /config

COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["frp"]
