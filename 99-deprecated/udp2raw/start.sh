#!/bin/sh

config=${CONFIG:-"/config/config.cfg"}
nslookup.awk "$config" > /config/config_gen.cfg
su-exec udp2raw udp2raw --conf-file /config/config_gen.cfg
