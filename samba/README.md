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

### Accounts without plaintext passwords

`users.txt` holds passwords in plaintext, which is a password list on the file
server. Set `PASSDB_FILE` to a file in `smbpasswd` format instead, and the
accounts are supplied as NT hashes:

```text
# smbpasswd: name:uid:LM:NT:[flags]:LCT-xxxxxxxx:
alice-laptop:1000:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX:8846F7EAEE8FB117AD06BDD830B7586C:[U          ]:LCT-5E0BE100:
```

The `LCT-` field is when the password was last changed, as eight hex digits
of Unix time. It must not be `LCT-00000000`: Samba reads a password last set at
time zero as one that must be changed at next logon, and refuses every logon
with "password must change".

The file is imported into Samba's own passdb at startup, after the POSIX
accounts exist, so the directory it is mounted from can stay read-only. The
passdb is rebuilt from it on every start rather than added to, so an account
removed from the file stops logging in once the container restarts. With
`PASSDB_FILE` set, the password field in `users.txt` may be empty: those
records then only give the kernel a uid to own files with.

An NT hash is unsalted and knowing one is equivalent to knowing the password,
so the file is as sensitive as a password list. What it avoids is the password
itself being recoverable from the file server.

`username map` in `smb.conf` is what maps several login names onto one POSIX
account, which is how one person keeps two revocable credentials and one home
directory.

Then start the server:

```sh
docker build --pull -t local/samba ./samba
docker run --rm -p 445:445 \
  -e GROUP_FILE=/config/groups.txt \
  -e USER_FILE=/config/users.txt \
  -e PASSDB_FILE=/config/smbpasswd \
  -v "$PWD/config:/config:ro" \
  -v "$PWD/data:/shares" \
  -v samba-state:/var/lib/samba \
  local/samba
```

The default share is `data`, requires authentication, and disables SMB1 and
guest access. Mount a custom `/config/smb.conf` or set `CONFIG_FILE` to use a
different configuration. `LOG_LEVEL` defaults to `1`, and `PRIVATE_DIR`, where Samba keeps the passdb
it writes, to `/var/lib/samba/private`.

Rebuild regularly with `--pull` to receive Alpine and Samba security updates.
Do not commit account files: `users.txt` contains plaintext Samba passwords,
and a `PASSDB_FILE` contains NT hashes, which are equivalent to them.
