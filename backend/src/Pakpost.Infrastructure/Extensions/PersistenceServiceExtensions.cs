using Microsoft.EntityFrameworkCore;
using Npgsql;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Infrastructure.Persistence;
using Pakpost.Infrastructure.Persistence.Repositories;
using Pakpost.Infrastructure.Services;

namespace Pakpost.Infrastructure.Extensions;

public static class PersistenceServiceExtensions
{
    public static IServiceCollection AddPersistenceServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connection = configuration.GetConnectionString("Postgres");

        if (string.IsNullOrWhiteSpace(connection))
        {
            throw new InvalidOperationException("ConnectionStrings__Postgres missing");
        }

        // Preserve caller-specific SSL settings while bounding stalled database connections.
        var connectionOptions = new NpgsqlConnectionStringBuilder(connection)
        {
            Timeout = Math.Clamp(configuration.GetValue("Database:ConnectTimeoutSeconds", 15), 2, 60),
            CommandTimeout = Math.Clamp(configuration.GetValue("Database:CommandTimeoutSeconds", 30), 5, 180),
            MaxPoolSize = Math.Clamp(configuration.GetValue("Database:MaxPoolSize", 30), 1, 200)
        };

        services.AddSingleton<WorkspaceCryptography>();

        services.AddDbContext<PakpostDbContext>(options => options.UseNpgsql(connectionOptions.ConnectionString));

        services.AddScoped<IUnitOfWork>(provider =>
            provider.GetRequiredService<PakpostDbContext>());

        services.AddScoped<ITransactionManager>(provider =>
            provider.GetRequiredService<PakpostDbContext>());

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUserExternalIdentityRepository, UserExternalIdentityRepository>();
        services.AddScoped<IWorkspaceRepository, WorkspaceRepository>();
        services.AddScoped<IWorkspaceCapacity, WorkspaceCapacity>();
        services.AddScoped<IWorkspaceInvitationRepository, WorkspaceInvitationRepository>();
        services.AddScoped<ICollectionRepository, CollectionRepository>();
        services.AddScoped<ICollectionFolderRepository, CollectionFolderRepository>();
        services.AddScoped<ISavedRequestRepository, SavedRequestRepository>();
        services.AddScoped<ISavedRequestRevisionRepository, SavedRequestRevisionRepository>();
        services.AddScoped<ITeamRepository, TeamRepository>();
        services.AddScoped<IRequestEnvironmentRepository, RequestEnvironmentRepository>();

        return services;
    }
}
