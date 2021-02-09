FROM jupyter/minimal-notebook

USER root

RUN set -eux ; \
    npm install -g --unsafe-perm ijavascript ; \
    ijsinstall --install=global ; \
    chown -R jovyan /home/jovyan ; \
    :

USER jovyan

ENV NODE_PREFIX     "$HOME/.node_modules"
RUN set -eux ; \
    mkdir ${NODE_PREFIX} ; \
    mkdir ${NODE_PREFIX}/lib ; \
    mkdir ${NODE_PREFIX}/bin ; \
    npm config set prefix ${NODE_PREFIX} ; \
    :





