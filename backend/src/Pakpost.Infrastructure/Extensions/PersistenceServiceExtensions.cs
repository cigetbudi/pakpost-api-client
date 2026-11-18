using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Infrastructure.Persistence;
using Pakpost.Infrastructure.Persistence.Repositories;

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

        services.AddDbContext<PakpostDbContext>(options => options.UseNpgsql(connection));

        services.AddScoped<IUnitOfWork>(provider =>
            provider.GetRequiredService<PakpostDbContext>());

        services.AddScoped<ITransactionManager>(provider =>
            provider.GetRequiredService<PakpostDbContext>());

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUserExternalIdentityRepository, UserExternalIdentityRepository>();
        services.AddScoped<IWorkspaceRepository, WorkspaceRepository>();
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
