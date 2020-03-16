FROM debian:buster-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        apache2 \
        openssl \
    && rm -fr /var/lib/apt/lists/*

COPY default-ssl.conf ssl-params.conf first_run.sh /
COPY start.sh /usr/local/bin/

ENTRYPOINT ["start.sh"]
CMD ["webdav", "start"]

