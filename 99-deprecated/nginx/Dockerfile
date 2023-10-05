FROM debian:buster-slim

RUN apt-get update \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        nginx \
        openssl \
        apache2-utils \
    && rm -fr /var/lib/apt/lists/*

COPY start.sh /usr/bin/
CMD ["/usr/bin/start.sh"]

