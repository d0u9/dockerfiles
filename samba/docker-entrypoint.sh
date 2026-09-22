#!/bin/sh
set -eu

CONFIG_FILE=${CONFIG_FILE:-/config/smb.conf}
LOG_LEVEL=${LOG_LEVEL:-1}

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
        [ -n "$password" ] || {
            echo "Missing password for user: $user_name" >&2
            exit 1
        }
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

        printf '%s\n%s\n' "$password" "$password" | smbpasswd -s -a "$user_name" >/dev/null
    done < "$user_file"
}

[ -z "${GROUP_FILE:-}" ] || create_groups "$GROUP_FILE"
[ -z "${USER_FILE:-}" ] || create_users "$USER_FILE"

mkdir -p /run/samba /var/lib/samba/private /var/log/samba
testparm -s "$CONFIG_FILE" >/dev/null

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
