#!/bin/bash

set -e

PUID=${PUID:-0}
PGID=${PGID:-0}
UMASK=${UMASK:-$(umask)}
UNAME=ydl
GNAME=ydl

if ! [[ "$PGID" =~ ^[0-9]+$ && "$PUID" =~ ^[0-9]+$ ]]; then
    echo "PGID or PUID is not a number"
    exit 1
fi

if [ "$PGID" -ne 0 ]; then
    groupadd -g $PGID $GNAME
else
    GNAME=root
fi

if [ "$PUID" -ne 0 ]; then
    useradd -M -g $GNAME -u $PUID $UNAME ;
else
    UNAME=root
fi

chown $UNAME:$GNAME /config

umask $UMASK

touch /runtime/container_initialized

