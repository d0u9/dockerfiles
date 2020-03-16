#!/bin/bash

PUID=${PUID:-0}
PGID=${PGID:-0}
UMASK=${UMASK:-$(umask)}

# For the first run
SEALED_OFF="/sealed_off"
if [ ! -f $SEALED_OFF ]; then
    if [ "$PGID" != "0" ]; then
        GROUP="deluge"
        groupadd -g $PGID $GROUP
    fi

    if [ "$PUID" != "0" ]; then
        USER="deluge"
        useradd -m -s /sbin/nologin -u $PUID -g $PGID $USER
        echo "umask $UMASK" >> /home/$USER/.bashrc
    else
        echo "umask $UMASK" >> /root/.bashrc
    fi

    touch $SEALED_OFF
fi

exec start-stop-daemon -S -c $PUID:$PGID -k $UMASK -x /usr/bin/deluged -- -d &
exec gosu $PUID:$PGID deluge-web

