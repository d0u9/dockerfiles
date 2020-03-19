#!/bin/sh

config=${CONFIG:-"/config/config.cfg"}
su-exec udp2raw udp2raw --conf-file "$config"
