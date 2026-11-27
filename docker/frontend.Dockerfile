# syntax=docker/dockerfile:1
FROM oven/bun:1.4.4 AS build
WORKDIR /src
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
RUN bun run build

# Node is needed only for serving static build assets; the runtime is distroless.
FROM gcr.io/distroless/nodejs24-debian13:nonroot
WORKDIR /app
COPY --from=build --chown=65532:65532 /src/dist/ ./dist/
COPY --chown=65532:65532 docker/frontend/server.mjs ./server.mjs
COPY --chown=65532:65532 LICENSE NOTICE ADDITIONAL_TERMS.md /app/legal/
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER 65532:65532
# Distroless Node already sets ENTRYPOINT to node.
CMD ["/app/server.mjs"]
