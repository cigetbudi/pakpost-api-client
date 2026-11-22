# syntax=docker/dockerfile:1
# SDK is ONLY used by the explicitly invoked one-shot migration container.
# The always-running API uses .NET 10 Chiseled Extra, never this SDK image.
FROM mcr.microsoft.com/dotnet/sdk:10.0
WORKDIR /src
COPY backend/ ./
RUN dotnet tool restore && dotnet restore src/Pakpost.Api/Pakpost.Api.csproj
ENTRYPOINT ["dotnet", "ef"]
CMD ["database", "update", "--project", "src/Pakpost.Infrastructure/Pakpost.Infrastructure.csproj", "--startup-project", "src/Pakpost.Api/Pakpost.Api.csproj", "--context", "PakpostDbContext"]
