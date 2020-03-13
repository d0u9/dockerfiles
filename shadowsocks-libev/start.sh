#!/bin/sh

config=${CONFIG:-"/config/config.json"}
mode=${MODE:-"server"}

if [ $mode = "server" ]; then
    su-exec ss ss-server -c "$config"
else
    su-exec ss ss-client -c "$config"
fi
