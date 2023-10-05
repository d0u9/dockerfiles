#!/bin/bash
set -e

if [[ "$*" != nginx*start* ]]; then
    exec "$@"
fi

service nginx start

while true; do sleep 1000; done
