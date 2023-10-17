#!/bin/sh

set -e

echo "initializing ..."

addgroup -g ${PGID} server
adduser -D -H -G server -u ${PUID} server
chown server:server /runtime


if [ -n "$CERT_SUBJ" ]; then
    echo "create https cert: $CERT_PATH"
    mkdir -p $CERT_PATH
    chown -R server:server $CERT_PATH
    openssl req \
        -x509 \
        -nodes \
        -days ${CERT_DAYS} \
        -newkey rsa:2048 \
        -keyout ${CERT_PATH}/https.key \
        -out ${CERT_PATH}/https.crt \
        -subj "${CERT_SUBJ}"

    chown -R server:server /etc/https_cert/
fi

touch /runtime/container_initialized
