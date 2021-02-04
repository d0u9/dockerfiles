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

start-stop-daemon -S -c $PUID:$PGID -k $UMASK -x /usr/bin/deluged -- -d &
status=$?
if [ $status -ne 0 ]; then
  echo "Failed to start deluged: $status"
  exit $status
fi

gosu $PUID:$PGID deluge-web -d &
status=$?
if [ $status -ne 0 ]; then
  echo "Failed to start deluged-web: $status"
  exit $status
fi

while sleep 60; do
  ps aux |grep deluged |grep -q -v grep
  PROCESS_1_STATUS=$?
  ps aux |grep deluge-web |grep -q -v grep
  PROCESS_2_STATUS=$?
  if [ $PROCESS_1_STATUS -ne 0 -o $PROCESS_2_STATUS -ne 0 ]; then
    echo "One of the processes has already exited."
    exit 1
  fi
done

