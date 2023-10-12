From python:slim as builder

# Note: ${TARGETPLATFORM} will be `linux/amd64`
ARG TARGETPLATFORM

RUN set -e ; \
    apt-get update ; \
    apt-get install -y --no-install-recommends \
        wget \
        curl \
        jq \
        xz-utils \
        ffmpeg \
        ; \
    mkdir /build/ ; \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /build/yt-dlp ; \
    chmod a+x /build/yt-dlp ; \
    echo "======== install yt-dlp patched ffmpeg =========" ; \
    ffmpeg_arch=none ; \
    if [ "$TARGETPLATFORM" = "linux/amd64" ]; then ffmpeg_arch="linux64" ; \
    elif [ "$TARGETPLATFORM" = "linux/arm64" ]; then ffmpeg_arch="linuxarm64" ; \
    else echo "unknow TARGETPLATFORM, exit"; exit 1 ; \
    fi; \
    echo "$ffmpeg_arch" > /tmp/arch ; \
    wget -nv -O - "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-n6.0-latest-${ffmpeg_arch}-gpl-6.0.tar.xz" \
        | tar -xJ ; \
    mv /ffmpeg*/bin/* /build/ ; \
    : ;

FROM python:slim
COPY --from=builder /build/* /usr/local/bin/

RUN set -e ; \
    apt-get update ; \
    apt-get install -y --no-install-recommends \
        gosu \
        python3-certifi  \
        python3-brotli \
        python3-websockets \
        python3-mutagen \
        python3-xattr \
        python3-pycryptodome \
        python3-secretstorage \
        atomicparsley \
        ; \
    rm -rf /var/lib/apt/lists/* ; \
    rm -fr /tmp/* ; \
    mkdir /config ; \
    mkdir /runtime ; \
    mkdir /workdir ; \
    : ;

WORKDIR /workdir

COPY --chmod=755 init.sh /usr/local/bin/
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["-h"]
