#!/bin/bash
set -e

if [[ "$*" != webdav*start* ]]; then
    exec "$@"
fi

first_run="/inited"
if ! [ -f $first_run ]; then
    user=${USERNAME:-"root"}
    password=${PASSWORD:-"password"}

    digest="$( printf "%s:%s:%s" "$user" webdav "$password" | md5sum | awk '{print $1}' )"
    printf "%s:%s:%s\n" "$user" webdav "$digest" >> "/etc/apache2/users.password"

    chown www-data:www-data /etc/apache2/users.password

    touch $first_run
fi

service apache2 restart

while sleep 60; do
    ps aux | grep apache2 | grep -q -v grep
    status=$?

    if [ $status -ne 0 ]; then
        echo "process has already exited."
        exit 1
    fi
done
