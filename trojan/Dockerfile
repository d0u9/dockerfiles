FROM alpine as build

ENV TROJAN_VERSION 1.14.1
RUN apk add --no-cache --virtual .build-deps \
        wget \
        tar \
        build-base \
        cmake \
        boost-dev \
        openssl-dev \
        mariadb-connector-c-dev \
    && wget -nv -O - https://github.com/trojan-gfw/trojan/archive/v${TROJAN_VERSION}.tar.gz | tar -zx \
    && (cd trojan-${TROJAN_VERSION} && cmake . && make -j $(nproc) && strip -s trojan \
    && mv trojan /usr/bin)

FROM alpine
COPY --from=build /usr/bin/trojan /usr/bin/trojan

RUN apk add --no-cache --virtual .runtime-deps \
        libstdc++ \
        boost-system \
        boost-program_options \
        mariadb-connector-c

WORKDIR /config
CMD ["trojan", "config.json"]
