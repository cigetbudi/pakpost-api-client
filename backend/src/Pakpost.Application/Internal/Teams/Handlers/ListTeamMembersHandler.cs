using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Teams.DTOs;
using Pakpost.Application.Internal.Teams.Queries;

namespace Pakpost.Application.Internal.Teams.Handlers;

public sealed class ListTeamMembersHandler(
    IWorkspaceRepository w,
    ITeamRepository t,
    IUserRepository users
) : IRequestHandler<ListTeamMembersQuery, IReadOnlyList<TeamMemberDto>>
{
    public async ValueTask<IReadOnlyList<TeamMemberDto>> Handle(ListTeamMembersQuery q, CancellationToken ct)
    {
        if (await w.FindMemberAsync(q.WorkspaceId, q.ActorId, ct) is null)
            throw AppException.Forbidden();
        var team = await t.FindAsync(q.TeamId, ct);
        if (team is null || team.WorkspaceId != q.WorkspaceId)
            throw AppException.NotFound();
        var result = new List<TeamMemberDto>();
        foreach (var m in await t.ListMembersAsync(team.Id, ct))
        {var user = await users.FindByIdAsync(m.UserId, ct);
            if (user is not null)result.Add(new(user.Id, user.Email, user.DisplayName));
        }
        return result;
    }
}
