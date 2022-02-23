FROM alpine

RUN : \
    && apk add --no-cache --virtual .runtime-deps \
        nginx \
        openssl \
        apache2-utils \
    && :

CMD ["nginx", "-g", "daemon off;"]
