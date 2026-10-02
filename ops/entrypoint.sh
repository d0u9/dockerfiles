#!/bin/sh
set -eu

keys=/var/lib/ops/ssh
if [ ! -s "$keys/ssh_host_ed25519_key" ]; then
    ssh-keygen -q -t ed25519 -N '' -f "$keys/ssh_host_ed25519_key"
fi

for f in /etc/ops/ca.pub /etc/ops/principals; do
    [ -s "$f" ] || { echo "entrypoint: $f is missing" >&2; exit 1; }
done

# One login name per principal, all of them the ops account under another
# name. Anything that is not a plain account name is refused.
mkdir -p /run/ops /run/sshd
for f in passwd shadow group; do
    cp "/usr/local/share/ops/$f" "/run/ops/$f"
done
while read -r name; do
    [ -n "$name" ] || continue
    case $name in
        ops|root) continue ;;
        *[!a-z0-9._-]*|[!a-z_]*)
            echo "entrypoint: bad principal '$name'" >&2; exit 1 ;;
    esac
    echo "$name:x:1000:1000::/home/ops:/bin/bash" >> /run/ops/passwd
    echo "$name:*::0:::::" >> /run/ops/shadow
done < /etc/ops/principals
chmod 0644 /run/ops/passwd /run/ops/group
chmod 0640 /run/ops/shadow
exec /usr/sbin/sshd -D -e
