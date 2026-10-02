#!/bin/sh
set -eu

keys=/var/lib/ops/ssh
if [ ! -s "$keys/ssh_host_ed25519_key" ]; then
    ssh-keygen -q -t ed25519 -N '' -f "$keys/ssh_host_ed25519_key"
fi

for f in /etc/ops/ca.pub /etc/ops/emails; do
    [ -s "$f" ] || { echo "entrypoint: $f is missing" >&2; exit 1; }
done

# One login name per allowed email: the part before the @, which is what
# Cloudflare Access puts in the certificate's principal. Each is the ops
# account under another name. ops-principals later checks the full email.
# Anything that is not an email with a plain account name is refused.
mkdir -p /run/ops /run/sshd
for f in passwd shadow group; do
    cp "/usr/local/share/ops/$f" "/run/ops/$f"
done
while read -r email; do
    [ -n "$email" ] || continue
    email=$(printf '%s' "$email" | tr 'A-Z' 'a-z')
    case $email in
        *@*@*|@*|*@) echo "entrypoint: bad email '$email'" >&2; exit 1 ;;
        *@*) ;;
        *) echo "entrypoint: '$email' is not an email; list full emails" >&2; exit 1 ;;
    esac
    name=${email%%@*}
    case $name in
        ops|root|nobody) echo "entrypoint: '$email' would log in as $name" >&2; exit 1 ;;
        *[!a-z0-9._-]*|[!a-z_]*)
            echo "entrypoint: '$email' is not a usable login name" >&2; exit 1 ;;
    esac
    grep -q "^$name:" /run/ops/passwd && continue
    echo "$name:x:1000:1000::/home/ops:/bin/bash" >> /run/ops/passwd
    echo "$name:*::0:::::" >> /run/ops/shadow
done < /etc/ops/emails
chmod 0644 /run/ops/passwd /run/ops/group
chmod 0640 /run/ops/shadow
exec /usr/sbin/sshd -D -e
