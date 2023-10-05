#!/bin/sh

set -e

NGINX_CONFIG_DIR=${NGINX_CONFIG_DIR:-"/etc/nginx/conf.d"}

first_letter=$(printf %.1s "$1")

print_help() {
    if echo "$@" | grep -- "-h" > /dev/null 2>&1; then
        printf "\n"
        printf "If first arg start with dash, '-', all the arguments will be passed to nginx\n"
        exit 0
    fi
}

# if first arg looks like a flag, assume we want to run samba server
if [ "$first_letter" = '-' ]; then
    set -- nginx "$@"
fi

if [ "$1" = 'nginx' ]; then
    print_help "$@"

    # get the remains other than the first element
    # EX: Input: nginx -a -c config
    #     Output: -a -c config
    start=2
    for i in $(seq 1 $((start - 1))); do
        shift
    done


    if [ "$NGINX_CONFIG_DIR" != "/etc/nginx/conf.d" ]; then
        cp -r "$NGINX_CONFIG_DIR"/* /etc/nginx/conf.d/
        chown -R nginx:nginx /etc/nginx/conf.d/
    fi

    opts="$@"
    echo "arguments=$opts"

    /usr/local/bin/certbot-install.sh
    supervisord -c /runtime/supervisord.conf
fi

exec "$@"

