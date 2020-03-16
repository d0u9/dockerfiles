#!/bin/bash
set -e

if [[ "$*" != webdav*start* ]]; then
    exec "$@"
fi

init_file=/initialized

if [ -f $init_file ]; then
    service apache2 restart
else
    echo "Webdav is not initialized, Run:"
    echo "docker exec -it CONTAINER_NAME /first_run"
fi

while true; do sleep 1000; done
