#!/bin/sh

config=${CONFIG:-"/config/config.json"}

su-exec trojan trojan -c "$config"

