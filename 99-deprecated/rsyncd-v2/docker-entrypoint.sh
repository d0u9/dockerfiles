#!/bin/sh

set -e

CONFIG_FILE=${CONFIG_FILE:-""}

first_letter=$(printf %.1s "$1")

print_help() {
    if echo "$@" | grep -- "-h" > /dev/null 2>&1; then
        printf "\n"
        printf "If first arg start with dash, '-', all the arguments will be passed to rsync\n"
        printf "Possible environment variables:\n"
        printf "    CONFIG_FILE: path to config file. This environment variable has high priority.\n"
        exit 0
    fi
}

# if first arg looks like a flag, assume we want to run samba server
if [ "$first_letter" = '-' ]; then
    set -- rsync "$@"
fi

if [ "$1" = 'rsync' ]; then
    # get the remains other than the first element
    # EX: Input: rsync -a -c config
    #     Output: -a -c config
    start=2
    for i in $(seq 1 $((start - 1))); do
        shift
    done

    opts="$@"
    if echo "$@" | grep -- "--config" > /dev/null 2>&1; then
        # If has '-c'
        if [ ! -z "$CONFIG_FILE" ]; then
            opts=$(echo "$@" | sed "s/--config \([^ ]*\)/--config $CONFIG_FILE/g")
        fi
    else
        # If doesn't have '-c'
        opts="$opts --config $CONFIG_FILE"
    fi
    echo "arguments=$opts"
    exec /usr/bin/rsync --daemon --no-detach --log-file=/dev/stdout $opts

    exec rsnyc $opts
fi

exec "$@"


