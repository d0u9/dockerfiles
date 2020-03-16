#!/bin/bash
set -e

if [[ "$*" == smb*start* ]]; then
    base_dir="/etc/samba"
    target_dir="$SMB_CONF_DIR"

    if [ -z "$(ls -A "$target_dir")" ]; then
        cp -r $base_dir/* $target_dir/
    fi

    rm -fr "$base_dir"
    ln -s "$target_dir" "$base_dir"

    smbd
    tail -f /dev/null
fi

exec "$@"
