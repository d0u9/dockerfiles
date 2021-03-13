FROM alpine

RUN set -e; \
    sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories; \
    apk --no-cache --no-progress upgrade; \
    apk --no-cache --no-progress add bash samba shadow tini tzdata;

COPY start.sh /usr/bin/

EXPOSE 139 445

CMD ["/sbin/tini", "--", "start.sh"]
