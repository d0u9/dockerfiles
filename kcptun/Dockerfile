FROM alpine as build

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
    tag=$(curl -s https://api.github.com/repos/xtaci/kcptun/releases/latest | jq .tag_name -r); \
    echo "$tag"; \
    version=$(bash -c "echo ${tag:1}"); \
    pkg="kcptun-${TARGETPLATFORM//\//-}-${version}.tar.gz"; \
    wget -nv -O - https://github.com/xtaci/kcptun/releases/download/${tag}/${pkg} \
        | tar -xz; \
    cp client_${TARGETPLATFORM//\//_} /usr/local/bin/kcp-client; \
    cp server_${TARGETPLATFORM//\//_} /usr/local/bin/kcp-server; \
    :;


FROM alpine
COPY --from=build /usr/local/bin/kcp-client /usr/local/bin/kcp-server /usr/local/bin

ARG UID=3004
ARG GID=3004

RUN set -e; \
    addgroup -g ${UID} kcptun; \
    adduser -H -D -G kcptun -u ${GID} kcptun; \
    :;

USER kcptun:kcptun
WORKDIR /config

COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["kcptun"]

