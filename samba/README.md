# deluge-web

---

## Install

1. From DockerHUB

        docker pull d0u9/samba

    For china users, use aliyun docker mirror instead:

        docker pull registry.cn-hangzhou.aliyuncs.com/master/samba

2. From DockerFile

        cd /tmp
        docker build -f </path/to/Dockerfile> -t samba .

## Usage

1. Run container

        docker -d \
            --name <container_name> \
            -p 139:139 \
            -p 445:445 \
            -v <samba_etc>:/var/samba \
            -v [one or more mount path according to your needs] \
            d0u9/samba

    Note:

    Here, in the container, the `/etc/samba` dir is a symbolic link to
    `/var/samba`. So you can bind-mount any samba configuration dir
    `<samba_ect>` into the container in `/var/samba`, and in turn be linked to
    `/etc/samba`.

    If the `<samba_etc>` dir is empty, the first run of the image will create
    the default configuration files there. You can manually modify this
    configuration file. Docker will load these settings after a restart of the
    container.

2. Automatically start container after booting

    Create `/etc/systemd/system/docker-deluge_web.service`, and fill with
    contents below:

        [Unit]
        Description=Samba Container
        Requires=docker.service
        After=docker.service

        [Service]
        Restart=always
        ExecStart=/usr/bin/docker start -a <container_name>
        ExecStop=/usr/bin/docker stop -t 2 <container_name>

        [Install]
        WantedBy=default.target

## Management

1. User & Group management

    Samba server tightly depends on the system's user and group if you want to
    benefit from the `[homes]` section in the `smb.conf` file. So, how to
    migrate these users and groups after a image upgrade is very important. To
    achieve this goal, I wrote some bash scripts to easy this dirty task. 
    Anyone who are curious about the impletation can check [my github](https://github.com/d0u9/docker/blob/master/dockerfiles/samba/usradmin).

    Let me show you how to migrate.

    if you want to export all the users and groups, simply execute the command
    below:

        docker exec -it <container_name> smb_export

    This command will crate a directory named `migration` in the `/var/samba`.
    Remember that we have bind-mounted a host dir into it.

    After stop, remove and upgrade the image, run the container as before. And
    then execute the command:

        docker exec -it <container_name> smb_import

    This command will find the `migration` directory in the `/var/samba`, if
    there it is and it is valid, all the users and groups will be imported
    properly.

    Note:

    the password for samba user is defauly saved somewhere according to the
    `smb.conf` file. This loacation can be change by adding(or modifying) the
    `passdb backend` field (if you use samba as a standalone server, and manage
    users via passdb):

        passdb backend = tdbsam:/etc/samba/passdb.tdb

---


