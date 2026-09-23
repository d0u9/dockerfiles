#!/bin/sh
set -eu

CONFIG_FILE=${CONFIG_FILE:-/config/smb.conf}
LOG_LEVEL=${LOG_LEVEL:-1}
PRIVATE_DIR=${PRIVATE_DIR:-/var/lib/samba/private}

if [ ! -f "$CONFIG_FILE" ]; then
    CONFIG_FILE=/etc/samba/smb.conf
fi

valid_name() {
    case "$1" in
        ''|*[!a-zA-Z0-9_.-]*) return 1 ;;
    esac
}

create_groups() {
    group_file=$1

    while IFS=: read -r group_name group_id rest || [ -n "$group_name$group_id$rest" ]; do
        case "$group_name" in ''|'#'*) continue ;; esac
        valid_name "$group_name" || {
            echo "Invalid group name: $group_name" >&2
            exit 1
        }
        [ -z "$rest" ] || {
            echo "Invalid group record for $group_name" >&2
            exit 1
        }
        case "$group_id" in
            ''|*[!0-9]*) [ -z "$group_id" ] || {
                echo "Invalid gid for $group_name" >&2
                exit 1
            } ;;
        esac
        if ! getent group "$group_name" >/dev/null 2>&1; then
            if [ -n "$group_id" ]; then
                addgroup -g "$group_id" "$group_name"
            else
                addgroup "$group_name"
            fi
        fi
    done < "$group_file"
}

create_users() {
    user_file=$1

    while IFS=: read -r user_name password user_id groups rest || [ -n "$user_name$password$user_id$groups$rest" ]; do
        case "$user_name" in ''|'#'*) continue ;; esac
        valid_name "$user_name" || {
            echo "Invalid user name: $user_name" >&2
            exit 1
        }
        # A password here is optional when PASSDB_FILE supplies the
        # accounts: the entries in that file hold NT hashes, so the only
        # thing left for this record to do is give the kernel a uid to own
        # files with. Without PASSDB_FILE this is the only place a password
        # can come from, so it is still required.
        if [ -z "$password" ] && [ -z "${PASSDB_FILE:-}" ]; then
            echo "Missing password for user: $user_name" >&2
            exit 1
        fi
        [ -z "$rest" ] || {
            echo "Invalid user record for $user_name" >&2
            exit 1
        }
        case "$user_id" in
            ''|*[!0-9]*) [ -z "$user_id" ] || {
                echo "Invalid uid for $user_name" >&2
                exit 1
            } ;;
        esac
        case "$groups" in
            *[!a-zA-Z0-9_.,-]*)
                echo "Invalid group list for $user_name" >&2
                exit 1
                ;;
        esac

        primary_group=samba-users
        if [ -n "$groups" ]; then
            old_ifs=$IFS
            IFS=,
            set -- $groups
            IFS=$old_ifs
            primary_group=$1
        fi
        getent group "$primary_group" >/dev/null 2>&1 || addgroup "$primary_group"

        if ! id "$user_name" >/dev/null 2>&1; then
            if [ -n "$user_id" ]; then
                adduser -D -H -s /sbin/nologin -G "$primary_group" -u "$user_id" "$user_name"
            else
                adduser -D -H -s /sbin/nologin -G "$primary_group" "$user_name"
            fi
        fi

        if [ -n "$groups" ]; then
            old_ifs=$IFS
            IFS=,
            for group_name in $groups; do
                valid_name "$group_name" || {
                    echo "Invalid group name: $group_name" >&2
                    exit 1
                }
                getent group "$group_name" >/dev/null 2>&1 || addgroup "$group_name"
                addgroup "$user_name" "$group_name" >/dev/null 2>&1 || true
            done
            IFS=$old_ifs
        fi

        [ -z "$password" ] || printf '%s\n%s\n' "$password" "$password" | smbpasswd -s -a "$user_name" >/dev/null
    done < "$user_file"
}

# import_passdb loads accounts from a file in smbpasswd format, so the
# accounts can be supplied as NT hashes rather than as plaintext. It is what
# lets a generated deployment put an account table on the file server without
# putting the passwords there: the hash is what SMB proves knowledge of.
#
# The file is imported rather than used as the passdb backend directly, so
# smbd keeps writing its own state to PRIVATE_DIR and the directory the
# accounts are mounted from can stay read-only.
import_passdb() {
    passdb_file=$1

    [ -f "$passdb_file" ] || {
        echo "PASSDB_FILE not found: $passdb_file" >&2
        exit 1
    }
    mkdir -p "$PRIVATE_DIR"
    pdbedit \
        --configfile="$CONFIG_FILE" \
        -i "smbpasswd:$passdb_file" \
        -e "tdbsam:$PRIVATE_DIR/passdb.tdb" >/dev/null
}

# With PASSDB_FILE the accounts are that file, entire, so the passdb is
# rebuilt from it on every start rather than added to. The passdb lives on a
# persistent volume: importing into it only adds, so an account removed from
# the file would keep logging in, and an entry imported with a bad field would
# outlive the fix. Removing it first makes the file the whole truth. It
# happens before create_users, so a plaintext account users.txt still adds is
# kept.
if [ -n "${PASSDB_FILE:-}" ]; then
    rm -f "$PRIVATE_DIR/passdb.tdb"
fi

[ -z "${GROUP_FILE:-}" ] || create_groups "$GROUP_FILE"
[ -z "${USER_FILE:-}" ] || create_users "$USER_FILE"

mkdir -p /run/samba "$PRIVATE_DIR" /var/log/samba
testparm -s "$CONFIG_FILE" >/dev/null

# After the POSIX accounts exist: an entry names an account by name, and
# importing one before the account is there leaves it unresolvable.
[ -z "${PASSDB_FILE:-}" ] || import_passdb "$PASSDB_FILE"

if [ "${1:-}" = "smbd" ]; then
    shift
    exec smbd \
        --foreground \
        --no-process-group \
        --debug-stdout \
        --debuglevel="$LOG_LEVEL" \
        --configfile="$CONFIG_FILE" \
        "$@"
fi

case "${1:-}" in
    -*)
        exec smbd \
            --foreground \
            --no-process-group \
            --debug-stdout \
            --debuglevel="$LOG_LEVEL" \
            --configfile="$CONFIG_FILE" \
            "$@"
        ;;
esac

exec "$@"
