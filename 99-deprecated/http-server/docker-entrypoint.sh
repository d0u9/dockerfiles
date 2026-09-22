#!/bin/sh

set -e

BIN=http-server
CERT_SUBJ=${CERT_SUBJ:-""}
CERT_DAYS=${CERT_DAYS:-30}
CERT_PATH=/etc/https_cert/
USERNAME=${USERNAME-""}
PASSWORD=${PASSWORD-""}
PUID=${PUID:-"3004"}
PGID=${PGID:-"3004"}
UNAME=server
GNAME=server

if [ ! -e "/runtime/container_initialized" ]; then
    CERT_DAYS=$CERT_DAYS \
    CERT_SUBJ=$CERT_SUBJ \
    CERT_PATH=$CERT_PATH \
    PUID=$PUID \
    PGID=$PGID \
    UNAME=$UNAME \
    GNAME=$GNAME \
    /usr/local/bin/init.sh
fi

print_help() {
    if echo "$@" | grep -- "-h" > /dev/null 2>&1; then
        printf "\n"
        printf "If first arg start with dash, '-', all the arguments will be passed to ${BIN}\n"
        printf "Possible environment variables:\n"
        printf "    CERT_SUBJ: if it is set, a self-signed cert will be generated, and https is enabled\n"
        printf "    CERT_EXPIRE: Days for the https cert life, only meaningful if CERT_SUBJ is enabled\n"
        printf "\n"
        printf "Using `openssl x509 -enddate -noout -in  /etc/https_cert/https.crt` to get expire date\n"
        exit 0
    fi
}

# if first arg looks like a flag, assume we want to run samba server
if [ "$first_letter" = '-' ]; then
    set -- ${BIN} "$@"
fi

if [ "$1" = "$BIN" ]; then
    test -z "$BIN" && echo "no bin environment is specified"
    print_help "$@"

    # get the remains other than the first element
    # EX: Input: http-server -a -c config
    #     Output: -a -c config
    start=2
    for i in $(seq 1 $((start - 1))); do
        shift
    done

    opts="$@ -p 8080"
    if [ -n "$CERT_SUBJ" ]; then
        opts="$opts --tls --cert ${CERT_PATH}/https.crt --key ${CERT_PATH}/https.key"
    fi

    if [ -n "$USERNAME" ] && [ -n "$PASSWORD" ]; then
        opts="$opts --username ${USERNAME} --password ${PASSWORD}"
    fi

    echo "arguments=$opts"

    su-exec $UNAME:$GNAME $BIN $opts
fi

exec "$@"



