# deluge-web

---

## Install

1. From DockerHUB

        docker pull d0u9/deluge_web

    For china users, use aliyun docker mirror instead:

        docker pull registry.cn-hangzhou.aliyuncs.com/master/shadowsocks-libev

2. From DockerFile

        cd /tmp
        docker build -f </path/to/Dockerfile> -t deluge_web .

## Usage

1. Run container

        docker -d \
            --name <container_name> \
            -p <host_port>:8112 \
            -v <host_volumn>:<container_volumn> \
            -e PUID=<UID> \
            -e PGID=<GID> \
            -e UMASK=<UMASK> \
            deluge_web

2. Automatically start container after booting

    Create `/etc/systemd/system/docker-deluge_web.service`, and fill with content below:

        [Unit]
        Description=Deluge Web Container
        Requires=docker.service
        After=docker.service

        [Service]
        Restart=always
        ExecStart=/usr/bin/docker start -a <container_name>
        ExecStop=/usr/bin/docker stop -t 2 <container_name>

        [Install]
        WantedBy=default.target

3. Visit `http://localhost:<host_port>, the default password is `deluge`.

4. After login, modify the download directory to the location where host volumn
mounted.

---


