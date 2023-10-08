#!/bin/sh

config=${CONFIG:-"/config/config.cfg"}

su-exec haproxy haproxy -f "$config"

