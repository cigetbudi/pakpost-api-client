using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Environments.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Environments.Services;

public static class EnvironmentAccess
{
    public static async Task<WorkspaceMember> Verify(IWorkspaceRepository workspaces, Guid ws, Guid actor, bool write, CancellationToken ct)
    => await WorkspacePermissions.RequireAsync(workspaces, ws, actor,
        write?WorkspacePermissions.EnvironmentWrite:WorkspacePermissions.EnvironmentRead, ct);
    // A read-only member cannot decrypt a shared secret. A masked value is not an empty secret.
    public static RequestEnvironmentDto ToDto(RequestEnvironment env, IEnvironmentValueCipher cipher, bool canReadSecrets)
    => new(env.Id, env.Name, env.Variables.Select(v => new EnvironmentVariableDto(
        v.Key, v.IsSecret?(canReadSecrets?cipher.Unprotect(v.StoredValue):string.Empty):v.StoredValue,
        v.IsSecret, v.IsSecret && !canReadSecrets)).ToArray());
}
