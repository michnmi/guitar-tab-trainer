# ---- build stage ----
FROM golang:1.22-alpine AS build
WORKDIR /app

COPY go.mod ./
COPY main.go ./
COPY web ./web

# IMPORTANT: no GOARCH hardcoded
RUN CGO_ENABLED=0 go build -o server main.go

# ---- run stage ----
FROM alpine:3.20
WORKDIR /app

RUN adduser -D -H -u 10001 appuser
USER appuser

COPY --from=build /app/server /app/server
COPY --from=build /app/web /app/web

ENV PORT=8080
EXPOSE 8080

CMD ["/app/server"]
