#!/bin/sh

set -e

PUID=${PUID:-0}
PGID=${PGID:-0}
UMASK=${UMASK:-$(umask)}
UNAME=deluge
GNAME=deluge

if ! [[ "$PGID" =~ ^[0-9]+$ && "$PUID" =~ ^[0-9]+$ ]]; then
    echo "PGID or PUID is not a number"
    exit 1
fi

if [ "$PGID" -ne 0 ]; then
    addgroup -g $PGID $GNAME
else
    GNAME=root
fi


if [ "$PUID" -ne 0 ]; then
    adduser -D -H -G $UNAME -u $PUID $UNAME
else
    UNAME=root
fi

chown $UNAME:$GNAME /config /runtime /home/deluge

touch /runtime/container_initialized

