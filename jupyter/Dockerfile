FROM jupyter/minimal-notebook

USER root

ENV NODE_VERSION 14.15.4

RUN set -eux ; \
    wget -nv https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz ; \
    tar -xf node-v${NODE_VERSION}-linux-x64.tar.xz ; \
    cp -r node-v${NODE_VERSION}-linux-x64/* /usr/ ; \
    rm -fr node-v${NODE_VERSION}-* ; \
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





