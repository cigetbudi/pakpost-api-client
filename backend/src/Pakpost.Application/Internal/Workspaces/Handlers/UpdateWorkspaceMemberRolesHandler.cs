using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Application.Internal.Workspaces.Services;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class UpdateWorkspaceMemberRolesHandler(
    IWorkspaceRepository workspaces,
    IUserRepository users,
    IUnitOfWork unitOfWork)
    : IRequestHandler<UpdateWorkspaceMemberRolesCommand, MemberDto>
{
    public async ValueTask<MemberDto> Handle(
        UpdateWorkspaceMemberRolesCommand command,
        CancellationToken ct)
    {
        var actor = await WorkspacePermissions.RequireAsync(
            workspaces,
            command.WorkspaceId,
            command.ActorId,
            WorkspacePermissions.RoleAssign,
            ct);

        if (command.ActorId == command.UserId)
        {
            throw AppException.Forbidden("You cannot change your own roles");
        }

        var target = await workspaces.FindMemberForUpdateAsync(
            command.WorkspaceId,
            command.UserId,
            ct) ?? throw AppException.NotFound("Workspace member not found");

        var workspace = await workspaces.FindAsync(command.WorkspaceId, ct)
            ?? throw AppException.NotFound();

        if (target.UserId == workspace.OwnerUserId)
        {
            throw AppException.Forbidden("Cannot modify the founder's roles");
        }

        RoleDelegation.CheckCanModify(actor, target);
        RoleDelegation.Check(actor, command.Roles);

        target.ReplaceRoles(command.Roles);
        await unitOfWork.SaveChangesAsync(ct);

        var user = await users.FindByIdAsync(command.UserId, ct)
            ?? throw AppException.NotFound();

        var roles = WorkspacePermissions.RolesOf(target);

        return new MemberDto(
            target.UserId,
            user.Email,
            user.DisplayName,
            target.Role,
            roles,
            WorkspacePermissions.EffectivePermissions(roles));
    }
}
