using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;

public sealed class UpdateWorkspaceMemberRolesHandler(IWorkspaceRepository workspaces, IUserRepository users, IUnitOfWork uow)
    : IRequestHandler<UpdateWorkspaceMemberRolesCommand, MemberDto>
{
    public async ValueTask<MemberDto> Handle(UpdateWorkspaceMemberRolesCommand request, CancellationToken ct)
    {
        var actor = await WorkspacePermissions.RequireAsync(workspaces, request.WorkspaceId, request.ActorId,
            WorkspacePermissions.RoleAssign, ct);
        if (request.ActorId == request.UserId)
            throw AppException.Forbidden("You cannot change your own roles");
        var target = await workspaces.FindMemberForUpdateAsync(request.WorkspaceId, request.UserId, ct)
        ??throw AppException.NotFound("Workspace member not found");
        var ws = await workspaces.FindAsync(request.WorkspaceId, ct)??throw AppException.NotFound();
        // Immutable founder until an explicit audited workspace ownership-transfer feature exists.
        if (target.UserId == ws.OwnerUserId)
            throw AppException.Forbidden("Cannot modify the founder's roles");
        var before = WorkspacePermissions.RolesOf(target);
        if (!WorkspacePermissions.RolesOf(actor).Contains(WorkspaceAccessRole.TeamLead) &&
            before.Any(r => r is WorkspaceAccessRole.TeamLead or WorkspaceAccessRole.WorkspaceAdmin))
        throw AppException.Forbidden("Only Team Lead may modify privileged members");
        RoleDelegation.Check(actor, request.Roles);
        target.ReplaceRoles(request.Roles);
        await uow.SaveChangesAsync(ct);
        var user = await users.FindByIdAsync(request.UserId, ct)??throw AppException.NotFound();
        var assigned = WorkspacePermissions.RolesOf(target);
        return new(target.UserId, user.Email, user.DisplayName, target.Role, assigned,
            WorkspacePermissions.EffectivePermissions(assigned));
    }
}
