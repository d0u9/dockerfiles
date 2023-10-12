#!/bin/sh

set -e

if [ ! -e "/runtime/container_initialized" ]; then
    /usr/local/bin/init.sh
fi

BIN=yt-dlp
CONFIG_FILE=${CONFIG_FILE:-""}

print_help() {
    if echo "$@" | grep -- "-h" > /dev/null 2>&1; then
        printf "\n"
        printf "If first arg start with dash, '-', all the arguments will be passed to ${BIN}\n"
        printf "Possible environment variables:\n"
        printf "    CONFIG_FILE: path to config file. This environment variable has high priority.\n"
        exit 0
    fi
}

if [ "$1" = "sh" ] || [ "$1" = "bash" ]; then
    exec "$@"
fi

opts="$@"
if echo "$@" | grep -- "--config-locations" > /dev/null 2>&1; then
    # If has '--config-locations'
    if [ ! -z "$CONFIG_FILE" ]; then
        opts=$(echo "$@" | sed "s/--config-locations \([^ ]*\)/--config-locations $CONFIG_FILE/g")
    fi
elif [ ! -z "$CONFIG_FILE" ]; then
    # If doesn't have '-c'
    opts="--config-locations $CONFIG_FILE $opts"
fi
echo "arguments=$opts"

gosu $PUID:$PGID $BIN $opts
