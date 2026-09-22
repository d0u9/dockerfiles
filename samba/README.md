# Samba

Alpine-based Samba file server. The image uses Alpine edge because its Samba
package contains the July 2026 security release; the stable Alpine 3.24 package
does not yet contain those fixes. `apk upgrade` is run during every build so
base-system security fixes are included as well.

## Run

Create the account files on the host:

```text
# groups.txt: name:gid (gid is optional)
samba-users:1000

# users.txt: name:password:uid:comma-separated-groups
alice:change-me:1000:samba-users
```

Then start the server:

```sh
docker build --pull -t local/samba ./samba
docker run --rm -p 445:445 \
  -e GROUP_FILE=/config/groups.txt \
  -e USER_FILE=/config/users.txt \
  -v "$PWD/config:/config:ro" \
  -v "$PWD/data:/shares" \
  -v samba-state:/var/lib/samba \
  local/samba
```

The default share is `data`, requires authentication, and disables SMB1 and
guest access. Mount a custom `/config/smb.conf` or set `CONFIG_FILE` to use a
different configuration. `LOG_LEVEL` defaults to `1`.

Rebuild regularly with `--pull` to receive Alpine and Samba security updates.
Do not commit user files: they contain plaintext Samba passwords.
