#!/bin/sh

set -e

echo "initializing container ..."

create_groups() {
    echo "create groups ..."
    group_file=$1
    while read line; do
        gname=$(echo "$line" | cut -d ':' -f 1)
        gid=$(echo "$line" | cut -d ':' -f 2)

        if [ -z "$gname" ]; then
            echo "error in group file, no group name is specified"
            exit 1
        fi

        gid=${gid:+"-g $gid"}
        echo "[ADD GROUP] groupadd $gid $gname"
        groupadd $gid "$gname"
    done < $group_file
}

create_users() {
    echo "create users ..."
    user_file=$1

    while read line; do
        uname=$(echo "$line" | cut -d ':' -f 1)
        passwd=$(echo "$line" | cut -d ':' -f 2)
        uid=$(echo "$line" | cut -d ':' -f 3)
        groups=$(echo "$line" | cut -d ':' -f 4)

        if [ -z "$uname" ]; then
            echo "error in user file, no user name is specified"
            exit 1
        fi

        uid=${uid:+"-u $uid"}
        groups=${groups:+"-G $groups"}
        echo "[ADD USER] useradd -M -N -s /sbin/nologin $uid $groups $uname"
        useradd -M -N -s /sbin/nologin $uid $groups $uname

        echo -e "$passwd\n$passwd" | smbpasswd -s -a $uname

    done < $user_file
}


if [ -z "$GROUP_FILE" ]; then
   echo "no group file is specified, creating dummy group"
   echo "smb:" > /tmp/nogroup
   GROUP_FILE=/tmp/nogroup
fi

if [ -z "$USER_FILE" ]; then
   echo "no user file is specified, creating dummy user"
   echo "smb:badpassword::" > /tmp/nouser
   USER_FILE=/tmp/nouser
fi

create_groups $GROUP_FILE
create_users $USER_FILE


touch /runtime/container_initialized
