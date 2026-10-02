# Idle shells end on their own; an unlocked shell takes its token with it.
TMOUT=900
readonly TMOUT
export TMOUT

# sshd does not pass the container's environment to a login, so the locale is
# set here. Without it, BusyBox less read the opbook as 8-bit text and turned
# any UTF-8 byte 0x9b (the C1 CSI code) into a stray '{', dropping characters
# such as 进 and 直. GNU less from the image takes this charset too.
export LANG=C.UTF-8
export LESSCHARSET=utf-8

# Interactive bash gets completion, doctl's included; the unlocked shell
# sources this same file through its rcfile.
if [ -n "${BASH_VERSION:-}" ] && [ -r /usr/share/bash-completion/bash_completion ]; then
    case $- in *i*) . /usr/share/bash-completion/bash_completion ;; esac
fi

# A dropped connection sends SIGHUP to everything started from it, which could
# stop ops-new-ip between unassigning the old address and assigning the new
# one. A login therefore runs inside the shared tmux session "ops": tmux keeps
# the shells after a disconnect, and the next login attaches to them again.
# If tmux cannot start, the plain shell carries on.
case $- in
    *i*)
        if [ -z "${TMUX:-}" ] && [ -z "${OPS_UNLOCKED:-}" ] && command -v tmux >/dev/null; then
            tmux new-session -A -s ops && exit
        fi
        ;;
esac

# A login shell opens with a banner that points at the opbook: whoever lands
# here is in an emergency and should read it before changing anything. Colour
# only on a terminal; unlocked child shells skip it.
case $- in
    *i*)
        if [ -z "${OPS_UNLOCKED:-}" ]; then
            if [ -t 1 ]; then
                y=$(printf '\033[1;33m') b=$(printf '\033[1;37;41m') r=$(printf '\033[0m')
            else
                y= b= r=
            fi
            cat <<BANNER

${y}+----------------------------------------------------------+${r}
${y}|${r}  ${b} OPS EMERGENCY TOOLBOX ${r}                                 ${y}|${r}
${y}|${r}                                                          ${y}|${r}
${y}|${r}  Read the opbook before changing anything:               ${y}|${r}
${y}|${r}                                                          ${y}|${r}
${y}|${r}      ${y}ops-help book${r}                                       ${y}|${r}
${y}|${r}                                                          ${y}|${r}
${y}|${r}  Command list: ops-help     Unlock a token: ops-unlock   ${y}|${r}
${y}+----------------------------------------------------------+${r}

BANNER
            unset y b r
        fi
        ;;
esac
