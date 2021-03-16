FROM alpine

RUN set -e; \
    apk --no-cache --no-progress upgrade; \
    apk --no-cache --no-progress add bash tini rsync;

COPY start.sh /usr/bin/

EXPOSE 873

CMD ["/sbin/tini", "--", "start.sh"]
