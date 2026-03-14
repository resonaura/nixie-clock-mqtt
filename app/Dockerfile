ARG BUILD_FROM
FROM $BUILD_FROM

WORKDIR /usr/src/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs jq \
    && rm -rf /var/lib/apt/lists/*

COPY . ./

RUN npm install && npm run build

COPY addon.sh /addon.sh
RUN chmod +x /addon.sh

CMD [ "/addon.sh" ]
