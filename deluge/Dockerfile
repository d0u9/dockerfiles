FROM debian:buster-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        deluged \
        deluge-webui \
        gosu \
    && rm -fr /var/lib/apt/lists/* \
    && FILE=$(find /usr/lib -path "*/deluge/ui/web/json_api.py") \
    && sed -i -r 's|^(\s*)(response = json\.dumps\(response\))|\1try:\n\1    \2\n\1except Exception:\n\1    response = json.dumps(response,ensure_ascii=False)|g' $FILE

COPY start.sh /usr/bin/
CMD ["/usr/bin/start.sh"]





