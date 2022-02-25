FROM python:alpine AS build

RUN : \
    && apk --no-cache add gcc musl-dev libffi-dev \
    && pip wheel --no-cache-dir --wheel-dir /wheels deluge libtorrent \
    && :

FROM python:alpine
COPY --from=build /wheels /wheels

RUN : \
    && apk --no-cache add su-exec shadow \
    && pip install --no-cache /wheels/* \
    && FILE=$(find /usr -path "*/deluge/ui/web/json_api.py") \
    && sed -i -r 's|^(\s*)(response = json\.dumps\(response\))|\1try:\n\1    \2\n\1except Exception:\n\1    response = json.dumps(response,ensure_ascii=False)|g' $FILE
    && mkdir /deluge \
    && chmod 1777 /deluge \
    && adduser -D deluge \
    && rm -fr /wheels \
    && :

WORKDIR /deluge
COPY start.sh /usr/bin/start.sh
CMD ["start.sh"]
