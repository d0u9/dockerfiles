#!/bin/sh

config=${CONFIG:-"/config/config.json"}
addr=$(jq -r .remote_addr $config)
port=$(jq -r .remote_port $config)

python3 /usr/bin/getcert.py $addr $port | tee /cert.pem
su-exec trojan trojan -c "$config"
