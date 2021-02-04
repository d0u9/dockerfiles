FROM ubuntu

RUN set -eux ; \
    apt-get update ; \
    apt-get install -y --no-install-recommends \
        deluged \
        deluge-web \
        gosu \
        ; \
    rm -fr /var/lib/apt/lists/*

COPY start.sh /usr/bin/
CMD ["/usr/bin/start.sh"]





