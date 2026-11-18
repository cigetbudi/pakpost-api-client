using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Application.Internal.Workspaces.Services;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class AddWorkspaceMemberHandler(
    IWorkspaceRepository workspaces,
    IUserRepository users,
    IUnitOfWork unitOfWork)
    : IRequestHandler<AddWorkspaceMemberCommand, MemberDto>
{
    public async ValueTask<MemberDto> Handle(
        AddWorkspaceMemberCommand command,
        CancellationToken ct)
    {
        var actor = await WorkspacePermissions.RequireAsync(
            workspaces,
            command.WorkspaceId,
            command.ActorId,
            WorkspacePermissions.MemberManage,
            ct);

        var roles = RoleDelegation.ResolveRequestedRoles(command.Role, command.Roles);
        RoleDelegation.Check(actor, roles);

        var email = command.Email.Trim().ToLowerInvariant();
        var user = await users.FindByEmailAsync(email, ct)
            ?? throw AppException.NotFound("User must sign in first");

        if (await workspaces.FindMemberAsync(command.WorkspaceId, user.Id, ct) is not null)
        {
            throw AppException.Conflict("Already a workspace member");
        }

        var legacyRole = roles.Contains(WorkspaceAccessRole.TeamLead) ||
            roles.Contains(WorkspaceAccessRole.WorkspaceAdmin)
            ? WorkspaceRole.Admin
            : WorkspaceRole.Member;

        workspaces.AddMember(new WorkspaceMember(
            command.WorkspaceId,
            user.Id,
            legacyRole,
            roles));

        await unitOfWork.SaveChangesAsync(ct);

        return new MemberDto(
            user.Id,
            user.Email,
            user.DisplayName,
            legacyRole,
            roles,
            WorkspacePermissions.EffectivePermissions(roles));
    }
}
