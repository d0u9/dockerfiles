FROM alpine

RUN set -e; \
    apk --no-cache --no-progress upgrade; \
    apk --no-cache --no-progress add bash samba shadow tini tzdata;

COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]

EXPOSE 139 445

CMD ["smbd"]
