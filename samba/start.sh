#!/bin/bash

set -e

# USER SETTING ENV FORMAT
# GROUP=<group1>[:GID1];<group2>[:GID2]
# USER=<username1:passwd1>[:UID1:groupA,groupB];<username2;passwd2>[:UID2:groupA,groupC]

# For test
#group_str="user1:1000;user2:2000;public:5000;ano"
#user_str="user1:passwd1:1000:user1,public;user2:passwd2:2000:user2,public,ano;public::5000:public"

group_str=${GROUP:-"guest"}
user_str=${USER:-"guest:badpassword"}

# Create groups
IFS=';' read -ra groups <<< "$group_str"; unset IFS
for group in "${groups[@]}"; do
    IFS=':'; arr=($group); unset IFS
    groupname=${arr[0]}
    gid=${arr[1]}

    echo "group=$groupname, gid=$gid"
    grep -q "$groupname:" /etc/group || addgroup ${gid:+-g "$gid"} $groupname
done

# Create users
IFS=';' read -ra users <<< "$user_str"; unset IFS
for user in "${users[@]}"; do
    IFS=':'; arr=($user); unset IFS
    username=${arr[0]}
    passwd=${arr[1]}
    uid=${arr[2]}
    user_groups=${arr[3]}

    echo "username=$username, passwd=$passwd, uid=$uid, user_groups=$user_groups"

    IFS=','; read -ra groups <<< "$user_groups"; unset IFS
    group_opt=""
    for group in "${groups[@]}"; do
        grep -q "^$group:" /etc/group || ( echo "Group $group for user $username doesn't exist"; exit 1 )
        group_opt="$group_opt -G $group"
    done

    grep -q "^$username:" /etc/passwd || adduser -D -H $group_opt ${uid:+-u $uid} $username
    echo -e "$passwd\n$passwd" | smbpasswd -s -a $username

done

ionice -c 3 smbd -FS --no-process-group < /dev/null
