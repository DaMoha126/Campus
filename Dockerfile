FROM alpine:3.22 AS download
RUN apk add --no-cache ca-certificates curl unzip
ARG PB_VERSION=0.40.5
WORKDIR /download
RUN curl -fsSLO "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
    && curl -fsSLO "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/checksums.txt" \
    && grep " pocketbase_${PB_VERSION}_linux_amd64.zip$" checksums.txt | sha256sum -c - \
    && unzip "pocketbase_${PB_VERSION}_linux_amd64.zip" pocketbase \
    && chmod +x pocketbase

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=download /download/pocketbase /app/pocketbase
COPY pocketbase/pb_hooks /app/pb_hooks
COPY pocketbase/pb_migrations /app/pb_migrations
COPY pocketbase/pb_public /app/pb_public
COPY scripts/start-cloud.sh /app/start-cloud.sh
RUN chmod +x /app/start-cloud.sh
ENV PORT=10000
EXPOSE 10000
ENTRYPOINT ["/app/start-cloud.sh"]
