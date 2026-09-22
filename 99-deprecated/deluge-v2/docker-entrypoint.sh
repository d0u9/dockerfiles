#!/bin/sh

set -e

if [ ! -e "/runtime/container_initialized" ]; then
    /runtime/init.sh
fi

first_letter=$(printf %.1s "$1")

print_help() {
    if echo "$@" | grep -- "-h" > /dev/null 2>&1; then
        printf "\n"
        printf "If first arg start with dash, '-', all the arguments will be passed to deluge-web\n"
        printf "Possible environment variables:\n"
        printf "    PGID: Run as this Group ID\n"
        printf "    PUID: Run as this User ID\n"
        printf "    UMASK: use this umask for process\n"
        exit 0
    fi
}

# if first arg looks like a flag, assume we want to run samba server
if [ "$first_letter" = '-' ]; then
    set -- deluge-web "$@"
fi


if [ "$1" = 'deluge' ]; then
    # get the remains other than the first element
    # EX: Input: frp -a -c config
    #     Output: -a -c config
    start=2
    for i in $(seq 1 $((start - 1))); do
        shift
    done

    opts="$@"
    echo "arguments=$opts"

    su-exec $PUID:$PGID supervisord -c /runtime/supervisord.conf
fi

exec "$@"


