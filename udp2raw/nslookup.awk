#!/usr/bin/awk -f
{
    if ( $0 ~ /^-r\s+/) {
        if ( $2 ~ /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])/) {
            # if use ip address
            print $0
        } else {
            # use hostname
            p = match($2, ":") - 1
            hostname = substr($2, 0, p)
            cmd = "nslookup " hostname " | awk '$0 ~ /Name:\\s+" hostname "/ { getline; print $2; exit}'"
            cmd  | getline ip
            sub(hostname, ip)
            print $0
        }
    } else {
        print $0
    }
}
