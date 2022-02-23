#!/bin/sh

PUID=${PUID:-0}
PGID=${PGID:-0}
UMASK=${UMASK:-0}

# For the first run
SEALED_OFF="/sealed_off"
if [ ! -f $SEALED_OFF ]; then
    if [ "$PGID" != "0" ]; then
        groupmod -g $PGID deluge
    fi

    if [ "$PUID" != "0" ]; then
        usermod -u $PUID deluge
    fi

    if [ "$UMASK" != "0" ]; then
        echo "umask $UMASK" >> /home/deluge/.bashrc
    fi

    touch $SEALED_OFF
fi

CONFIG=config
LOG_LEVEL=warning

su-exec deluge:deluge deluged \
    --user deluge \
    --group deluge \
    --config $CONFIG \
    --loglevel $LOG_LEVEL \
    --port 58846 \
    --pidfile $(pwd)/deluged.pid \
    ;

su-exec deluge:deluge deluge-web \
    --user deluge \
    --group deluge \
    --config $CONFIG \
    --loglevel $LOG_LEVEL \
    --port 8112 \
    --pidfile $(pwd)/deluge-web.pid \
    ;

KILLSIG=SIGTERM

trap quit SIGTERM
function quit() {
    kill -s $KILLSIG $(cat $(pwd)/deluge-web.pid)
    kill -s $KILLSIG $(cat $(pwd)/deluged.pid)

    exit 0
}


while true; do sleep 3; done
