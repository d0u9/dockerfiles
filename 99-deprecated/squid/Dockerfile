FROM alpine AS builder

RUN set -e ; \
    apk add go git ; \
    git clone https://github.com/rchunping/squid-urlrewrite.git urlrewrite ; \
    cd urlrewrite ; \
    go build -o /urlwrite main.go ;

FROM alpine

COPY --from=builder /urlwrite /bin/

RUN set -e ; \
    apk add --no-cache squid apache2-utils ;

CMD [ "squid", "--foreground" ]

