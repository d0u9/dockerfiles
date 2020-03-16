# webdav

---

## Install

1. From DockerHUB

        docker pull d0u9/webdav

    For china users, use aliyun docker mirror instead:

        docker pull registry.cn-hangzhou.aliyuncs.com/master/webdav

2. From DockerFile

        cd /tmp
        docker build -f </path/to/Dockerfile> -t webdav .

## Usage

1. Run container

        docker -d \
            --name <container_name> \
            -p 443:443 \
            -v [webdav_dir]:/webdav \
            d0u9/webdav

    Note:

    In the container, webdav will save all its contents in `/webdav`, so mount
    outside directory to this loacation for persistent storage.

2. Initializtion

    For the first time to use this image, user have to manually initialize
    container by executing:

        docker exec -it <container_name> /first_run

    this script will create self-signed certifications for HTTPs protocol.

3. Test

    Visit `https://ip:port/webdav` to see contents in the server.

---


