FROM alpine

RUN set -e; \
    apk add --no-cache \
        deluge \
        su-exec \
        supervisor \
        ; \
    mkdir /runtime ; \
    mkdir /config ; \
    mkdir /root/.config ; \
    mkdir -p /home/deluge/.config ; \
    ln -s /config /root/.config/deluge ; \
    ln -s /config /home/deluge/.config/deluge ; \
    :;

COPY supervisord.conf init.sh /runtime/

WORKDIR /runtime

COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["deluge"]
