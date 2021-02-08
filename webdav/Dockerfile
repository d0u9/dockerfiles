FROM debian:buster-slim

RUN set -eux ; \
    apt-get update ; \
    apt-get install -y --no-install-recommends \
        apache2 \
        ; \
    rm -fr /var/lib/apt/lists/* ; \
    mkdir /var/www/webdav ; \
    chown -R www-data:www-data /var/www/ ; \
    a2enmod dav ; \
    a2enmod dav_fs ; \
    a2enmod auth_digest ; \
    : ;

COPY start.sh /usr/bin/

ENTRYPOINT ["start.sh"]
CMD ["webdav", "start"]

