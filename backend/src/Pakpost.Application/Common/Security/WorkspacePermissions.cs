using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Common.Security;

public static class WorkspacePermissions
{
    public static async Task<WorkspaceMember> RequireMemberAsync(
        IWorkspaceRepository workspaces,Guid workspaceId,Guid actorId,CancellationToken ct)
        => await workspaces.FindMemberAsync(workspaceId,actorId,ct)
            ?? throw AppException.Forbidden();

    public static async Task RequireManagerAsync(
        IWorkspaceRepository workspaces,Guid workspaceId,Guid actorId,CancellationToken ct)
    {
        var actor=await RequireMemberAsync(workspaces,workspaceId,actorId,ct);
        if(actor.Role is not (WorkspaceRole.Owner or WorkspaceRole.Admin))
            throw AppException.Forbidden("Owner or Admin role required");
    }
}
