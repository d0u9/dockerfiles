#!/bin/bash

init_file=/initialized
webdav_root=/webdav

if [ -f $init_file ]; then
    echo "Already initialized!"
    exit 0
fi

echo "First time run, initializing...."

touch $init_file
rm -fr /var/www/html/index.html

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/apache-selfsigned.key \
    -out /etc/ssl/certs/apache-selfsigned.crt

openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048

install -m 644 -o root -g root /ssl-params.conf /etc/apache2/conf-available/ssl-params.conf
install -m 644 -o root -g root /default-ssl.conf /etc/apache2/sites-available/default-ssl.conf

a2enmod ssl                         2>&1 >/dev/null
a2enmod headers                     2>&1 >/dev/null
a2ensite default-ssl                2>&1 >/dev/null
a2enconf ssl-params                 2>&1 >/dev/null

a2enmod dav_fs                      2>&1 >/dev/null
a2enmod dav                         2>&1 >/dev/null

mkdir $webdav_root
chown www-data:users $webdav_root

result=0

a2enmod auth_digest                 2>&1 >/dev/null
mkdir /etc/password

echo "Create user for webdav"
read -p "username: " username
htdigest -c /etc/password/digest-password WebDavServer $username

service apache2 restart
