#!/bin/sh

config=${CONFIG:-"/config/config.conf"}

su-exec privoxy privoxy "$config"

