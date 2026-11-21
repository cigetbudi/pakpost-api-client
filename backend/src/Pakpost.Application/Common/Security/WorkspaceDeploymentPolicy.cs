using Microsoft.Extensions.Configuration;
using Pakpost.Application.Common.Interfaces;

namespace Pakpost.Application.Common.Security;

// Deployment policy is instance-wide, never inherited from a workspace role.
// Default to restricted SelfHosted to avoid accidentally opening workspace creation.
public sealed record WorkspaceDeploymentPolicy(string Mode, int? MaxMembers)
{
    public bool IsPublic => Mode == "Public";

    public static WorkspaceDeploymentPolicy From(IConfiguration configuration)
    {
        var mode = configuration["Pakpost:DeploymentMode"] ?? "SelfHosted";
        return mode.ToLowerInvariant() switch
        {
            "public" => new("Public", 10),
            "selfhosted" => new("SelfHosted", null),
            _ => throw new InvalidOperationException(
                "Pakpost:DeploymentMode must be Public or SelfHosted")
        };
    }

    public async Task<bool> CanCreateAsync(
        IUserRepository users, IUserExternalIdentityRepository identities,
        Guid userId, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(userId, ct);
        if (user is null || user.IsDisabled) return false;
        if (!IsPublic) return user.IsSuperAdmin || user.CanCreateWorkspaces;
        // Google-only accounts are verified via the provider-subject identity,
        // not merely by a self-asserted email address.
        return await identities.FindByUserProviderAsync(userId, "google", ct) is not null;
    }
}
