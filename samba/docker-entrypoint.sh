#!/bin/bash

set -e

create_group() {
    while read line; do
        readarray -t -d : fields <<< "$line:"
        gname=${fields[0]}
        gid=${fields[1]}
        if [ -z "$gname" ]; then
            echo "group name is empty: $line"; exit 1
        fi
        gid=${gid:+-g $gid}
        echo "[GROUP] groupadd $gid $gname"
        groupadd $gid $gname
    done < "$1"
}

create_user() {
    while read line; do
        readarray -t -d : fields <<< "$line:"

        uname=${fields[0]}
        passwd=${fields[1]}
        uid=${fields[2]}
        groups_str=${fields[3]}

        if [ -z "$uname" ]; then
            echo "user name is empty: $line"; exit 1
        fi
        uid=${uid:+-u $uid}
        groups=${groups_str:+-G $groups_str}

        echo "[USER] useradd -M -N -s /sbin/nologin $uid $groups $uname"
        useradd -M -N -s /sbin/nologin $uid $groups $uname
        echo -e "$passwd\n$passwd" | smbpasswd -s -a $uname

    done < "$1"
}

_main() {
    # if first arg looks like a flag, assume we want to run samba server
    if [ "${1:0:1}" = '-' ]; then
        set -- smbd "$@"
    fi

    if [ "$1" = 'smbd' ]; then
        if [ ! -f /inited ]; then
            echo "init container..."
            if [ -z "$SMB_GROUP_FILE" ]; then
                echo "smb:" > /tmp/nogroup
                export SMB_GROUP_FILE=/tmp/nogroup
            fi

            if [ -z "$SMB_USER_FILE" ]; then
                echo "smb:badpassword::" > /tmp/nouser
                export SMB_USER_FILE=/tmp/nouser
            fi

            create_group $SMB_GROUP_FILE
            create_user $SMB_USER_FILE
            touch /inited
        fi
        echo "start smbd..."
        exec /sbin/tini -- \
            smbd ${SMB_CONFIG:+-s $SMB_CONFIG} \
            -F \
            --no-process-group \
            -d ${SMB_LOGLEVEL:-0} \
            --debug-stdout
    fi

    exec "$@"
}

_main "$@"
