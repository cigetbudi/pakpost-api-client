using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Teams.DTOs;
using Pakpost.Application.Internal.Teams.Queries;

namespace Pakpost.Application.Internal.Teams.Handlers;

public sealed class ListTeamMembersHandler(
    IWorkspaceRepository workspaces,
    ITeamRepository teams,
    IUserRepository users)
    : IRequestHandler<ListTeamMembersQuery, IReadOnlyList<TeamMemberDto>>
{
    public async ValueTask<IReadOnlyList<TeamMemberDto>> Handle(
        ListTeamMembersQuery query,
        CancellationToken ct)
    {
        await WorkspacePermissions.RequireMemberAsync(
            workspaces,
            query.WorkspaceId,
            query.ActorId,
            ct);

        var team = await teams.FindAsync(query.TeamId, ct);

        if (team is null || team.WorkspaceId != query.WorkspaceId)
        {
            throw AppException.NotFound();
        }

        var memberships = await teams.ListMembersAsync(team.Id, ct);

        if (memberships.Count == 0)
        {
            return [];
        }

        var userIds = memberships.Select(member => member.UserId).Distinct().ToArray();
        var usersById = (await users.FindByIdsAsync(userIds, ct))
            .ToDictionary(user => user.Id);

        var result = new List<TeamMemberDto>(memberships.Count);

        foreach (var member in memberships)
        {
            if (usersById.TryGetValue(member.UserId, out var user))
            {
                result.Add(new TeamMemberDto(user.Id, user.Email, user.DisplayName));
            }
        }

        return result;
    }
}
