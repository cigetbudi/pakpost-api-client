using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces.Services;

public static class RoleDelegation
{
    public static IReadOnlyList<WorkspaceAccessRole> ResolveRequestedRoles(
        WorkspaceRole legacy, IReadOnlyList<WorkspaceAccessRole>? requested)
    {
        if (requested is {Count:>0})
            return requested.Distinct().ToArray();
        if (legacy == WorkspaceRole.Admin)
            return new[]{WorkspaceAccessRole.WorkspaceAdmin, WorkspaceAccessRole.Developer};
        return new[]{WorkspaceAccessRole.Developer};
    }
    public static void Check(WorkspaceMember actor, IEnumerable<WorkspaceAccessRole> requested)
    {
        var roles = requested.ToArray();
        if (!WorkspacePermissions.Can(actor, WorkspacePermissions.RoleAssign))
            throw AppException.Forbidden();
        if (!WorkspacePermissions.RolesOf(actor).Contains(WorkspaceAccessRole.TeamLead) &&
            roles.Any(r => r is WorkspaceAccessRole.TeamLead or WorkspaceAccessRole.WorkspaceAdmin))
        throw AppException.Forbidden("Only Team Lead may grant lead/admin roles");
    }
}
