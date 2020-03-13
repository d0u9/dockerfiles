#!/bin/sh

config=${CONFIG:-"/config/config.json"}
mode=${MODE:-"server"}

if [ $mode = "server" ]; then
    su-exec kcp kcp-server -c "$config"
else
    su-exec kcp kcp-client -c "$config"
fi
