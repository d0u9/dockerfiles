#!/bin/sh

config=${CONFIG:-"/config/config.ini"}
mode=${MODE:-"server"}

if [ $mode = "server" ]; then
    su-exec frp frps -c "$config"
else
    su-exec frp frpc -c "$config"
fi

