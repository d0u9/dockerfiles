#!/bin/sh

set -e

BIN="smbd"
USER_FILE=${USER_FILE:-""}
GROUP_FILE=${GROUP_FILE:-""}
CONFIG_FILE=${CONFIG_FILE:+"-s $CONFIG_FILE"}
LOG_LEVEL=${LOG_LEVEL:-0}

if [ ! -e "/runtime/container_initialized" ]; then
    USER_FILE=$USER_FILE GROUP_FILE=$GROUP_FILE /runtime/init.sh
fi

first_letter=$(printf %.1s "$1")

print_help() {
    if echo "$@" | grep -- "-h" > /dev/null 2>&1; then
        printf "\n"
        printf "If first arg start with dash, '-', all the arguments will be passed to smbd\n"
        printf "Possible environment variables:\n"
        printf "    CONFIG_FILE: SAMBA config file\n"
        printf "    USER_FILE: the file saves user info\n"
        printf "    GROUP_FILE: the file save group info\n"
        exit 0
    fi
}

# if first arg looks like a flag, assume we want to run samba server
if [ "$first_letter" = '-' ]; then
    set -- $BIN "$@"
fi

if [ "$1" = "$BIN" ]; then
    # get the remains other than the first element
    # EX: Input: smbd -a -c config
    #     Output: -a -c config
    start=2
    for i in $(seq 1 $((start - 1))); do
        shift
    done

    opts="$@"
    echo "arguments=$opts"

    exec $BIN \
        ${CONFIG_FILE} \
        -F \
        --no-process-group \
       -d $LOG_LEVEL \
       --debug-stdout
fi

exec "$@"
