using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;

public sealed class AddWorkspaceMemberHandler(IWorkspaceRepository workspaces, IUserRepository users, IUnitOfWork uow)
    : IRequestHandler<AddWorkspaceMemberCommand, MemberDto>
{
    public async ValueTask<MemberDto> Handle(AddWorkspaceMemberCommand request, CancellationToken ct)
    {
        var actor = await WorkspacePermissions.RequireAsync(workspaces, request.WorkspaceId, request.ActorId,
            WorkspacePermissions.MemberManage, ct);
        var roles = RoleDelegation.ResolveRequestedRoles(request.Role, request.Roles);
        RoleDelegation.Check(actor, roles);
        var user = await users.FindByEmailAsync(request.Email.Trim().ToLowerInvariant(), ct)
        ??throw AppException.NotFound("User must sign in first");
        if (await workspaces.FindMemberAsync(request.WorkspaceId, user.Id, ct) is not null)
            throw AppException.Conflict("Already a workspace member");
        var legacy = roles.Contains(WorkspaceAccessRole.TeamLead) || roles.Contains(WorkspaceAccessRole.WorkspaceAdmin)
        ?WorkspaceRole.Admin:WorkspaceRole.Member;
        workspaces.AddMember(new WorkspaceMember(request.WorkspaceId, user.Id, legacy, roles));
        await uow.SaveChangesAsync(ct);
        return new(user.Id, user.Email, user.DisplayName, legacy, roles,
            WorkspacePermissions.EffectivePermissions(roles));
    }
}
