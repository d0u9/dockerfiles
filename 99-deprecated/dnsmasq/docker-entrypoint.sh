#!/bin/sh

set -e

BIN=dnsmasq
CONFIG_FILE=${CONFIG_FILE:-""}

first_letter=$(printf %.1s "$1")

print_help() {
    if echo "$@" | grep -- "-h" > /dev/null 2>&1; then
        printf "\n"
        printf "If first arg start with dash, '-', all the arguments will be passed to dnsmasq\n"
        printf "Possible environment variables:\n"
        printf "    CONFIG_FILE: path to config file. This environment variable has high priority.\n"
        printf "    BIN: The binary wang to run, available options:\n"
        printf "         dnsmasq\n"
        exit 0
    fi
}

# if first arg looks like a flag, assume we want to run samba server
if [ "$first_letter" = '-' ]; then
    set -- dnsmasq "$@"
fi

if [ "$1" = 'dnsmasq' ]; then
    test -z "$BIN" && echo "no bin environment is specified"
    print_help "$@"

    # get the remains other than the first element
    # EX: Input: dnsmasq -a -C config
    #     Output: -a -C config
    start=2
    for i in $(seq 1 $((start - 1))); do
        shift
    done

    opts="$@ -d"
    if echo "$@" | grep -- "-C" > /dev/null 2>&1; then
        # If has '-C'
        if [ ! -z "$CONFIG_FILE" ]; then
            opts=$(echo "$@" | sed "s/-C \([^ ]*\)/-C $CONFIG_FILE/g")
        fi
    else
        # If doesn't have '-C'
        opts="$opts -C $CONFIG_FILE"
    fi
    echo "arguments=$opts"

    exec $BIN $opts
fi

exec "$@"
