using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Requests;
using Pakpost.Infrastructure.Persistence;
using Pakpost.Infrastructure.Persistence.Repositories;
using Pakpost.Infrastructure.Services;

namespace Pakpost.Infrastructure;
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connection = configuration.GetConnectionString("Postgres");
        if (string.IsNullOrWhiteSpace(connection))
            throw new InvalidOperationException("ConnectionStrings__Postgres missing");
        services.AddDbContext<PakpostDbContext>(options => options.UseNpgsql(connection));
        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<PakpostDbContext>());
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUserExternalIdentityRepository, UserExternalIdentityRepository>();
        services.AddSingleton<IGoogleIdentityVerifier, GoogleIdentityVerifier>();
        services.AddScoped<IWorkspaceRepository, WorkspaceRepository>();
        services.AddScoped<IWorkspaceInvitationRepository, WorkspaceInvitationRepository>();
        services.AddScoped<IWorkspaceInvitationEmailSender, SmtpWorkspaceInvitationEmailSender>();
        services.AddScoped<ICollectionRepository, CollectionRepository>();
        services.AddScoped<ISavedRequestRepository, SavedRequestRepository>();
        services.AddScoped<ISavedRequestRevisionRepository, SavedRequestRevisionRepository>();
        services.AddScoped<ITeamRepository, TeamRepository>();
        services.AddScoped<IRequestEnvironmentRepository, RequestEnvironmentRepository>();
        services.AddSingleton<IEnvironmentValueCipher, EnvironmentValueCipher>();
        services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        services.AddTransient<IHttpRequestRunner, SafeHttpRequestRunner>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        
        return services;
    }
}
