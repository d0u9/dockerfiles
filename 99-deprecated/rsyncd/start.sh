#!/bin/bash

/usr/bin/rsync \
    --daemon \
    --no-detach \
    --config=${CONFIG:-/config/rsyncd.conf} \
    --log-file=/proc/self/fd/0 \
    --dparam=pidfile=/var/run/rsyncd.pid
