# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# All application projects are in backend/src; .dockerignore excludes credentials,
# compiled binaries and local appsettings.
COPY backend/ ./
RUN dotnet restore src/Pakpost.Api/Pakpost.Api.csproj
RUN dotnet publish src/Pakpost.Api/Pakpost.Api.csproj \
    -c Release -o /out --no-restore /p:UseAppHost=false

# ICU + timezone information without shell/package manager.
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled-extra
WORKDIR /app
COPY --from=build /out/ ./
COPY LICENSE NOTICE ADDITIONAL_TERMS.md /app/legal/
ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false \
    TZ=Asia/Jakarta
EXPOSE 8080
USER 1654:1654
ENTRYPOINT ["dotnet", "Pakpost.Api.dll"]
