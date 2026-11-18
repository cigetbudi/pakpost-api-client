using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Teams.Commands;
using Pakpost.Application.Internal.Teams.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Teams.Handlers;

public sealed class AddTeamMemberHandler(
    IWorkspaceRepository w,
    ITeamRepository t,
    IUserRepository users,
    IUnitOfWork uow
) : IRequestHandler<AddTeamMemberCommand, TeamMemberDto>
{
    public async ValueTask<TeamMemberDto> Handle(AddTeamMemberCommand q, CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(w, q.WorkspaceId, q.ActorId, WorkspacePermissions.TeamManage, ct);
        var team = await t.FindAsync(q.TeamId, ct);
        if (team is null || team.WorkspaceId != q.WorkspaceId)
            throw AppException.NotFound();
        var user = await users.FindByEmailAsync(q.Email.Trim().ToLowerInvariant(), ct)
        ?? throw AppException.NotFound("User must register first");
        if (await w.FindMemberAsync(q.WorkspaceId, user.Id, ct) is null)
            throw AppException.BadRequest("User must join workspace first");
        if (await t.HasMemberAsync(team.Id, user.Id, ct))
            throw AppException.Conflict("Already a team member");
        t.AddMember(new TeamMember(team.Id, user.Id));
        await uow.SaveChangesAsync(ct);
        return new(user.Id, user.Email, user.DisplayName);
    }
}
