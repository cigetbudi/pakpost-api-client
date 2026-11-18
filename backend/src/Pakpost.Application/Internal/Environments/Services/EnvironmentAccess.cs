using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Environments.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Environments.Services;

public static class EnvironmentAccess
{
    public static Task<WorkspaceMember> Verify(
        IWorkspaceRepository workspaces,
        Guid workspaceId,
        Guid actorId,
        bool write,
        CancellationToken ct)
    {
        var permission = write
            ? WorkspacePermissions.EnvironmentWrite
            : WorkspacePermissions.EnvironmentRead;

        return WorkspacePermissions.RequireAsync(workspaces, workspaceId, actorId, permission, ct);
    }

    public static RequestEnvironmentDto ToDto(
        RequestEnvironment environment,
        IEnvironmentValueCipher cipher,
        bool canReadSecrets)
    {
        return new RequestEnvironmentDto(
            environment.Id,
            environment.Name,
            environment.Variables.Select(variable => new EnvironmentVariableDto(
                variable.Key,
                variable.IsSecret
                    ? canReadSecrets ? cipher.Unprotect(variable.StoredValue) : string.Empty
                    : variable.StoredValue,
                variable.IsSecret,
                variable.IsSecret && !canReadSecrets)).ToArray());
    }
}
