#!/bin/sh

set -e

if [ -z "$EMAIL" ]; then
    echo "environment 'EMAIL' is empty or not set, this email is used by letsencrypt for generating certificate"
    exit 1
fi

if [ -z "$CERTS" ]; then
    echo "variable 'CERTS' is empty or not set"
    exit 1
fi

nginx_shutdown=false
if [ ! -e /var/run/nginx.pid ]; then
    nginx
    nginx_shutdown=true
fi

# Set the IFS to ';' to split the input string into parts separated by ';'
IFS=';'
# Convert the input string into an array
set -- $CERTS

# Loop through the parts
for part; do
    opts=$(echo "$part" | awk -F '=' '{printf "--cert-name %s -d %s", $1, $2}')
    cmd="certbot run -n --nginx --agree-tos --email $EMAIL $opts"
    echo "$cmd"
    eval $cmd
done

if [ ! -z "$nginx_shutdown" ]; then
    kill $(cat /var/run/nginx.pid)
fi
