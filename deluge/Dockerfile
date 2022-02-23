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
    && mkdir /deluge \
    && chmod 1777 /deluge \
    && adduser -D deluge \
    && rm -fr /wheels \
    && :

WORKDIR /deluge
COPY start.sh /usr/bin/start.sh
CMD ["start.sh"]
