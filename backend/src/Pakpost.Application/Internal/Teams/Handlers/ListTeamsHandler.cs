using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Teams.DTOs;
using Pakpost.Application.Internal.Teams.Queries;

namespace Pakpost.Application.Internal.Teams.Handlers;

public sealed class ListTeamsHandler(
    IWorkspaceRepository workspaces,
    ITeamRepository teams)
    : IRequestHandler<ListTeamsQuery, IReadOnlyList<TeamDto>>
{
    public async ValueTask<IReadOnlyList<TeamDto>> Handle(
        ListTeamsQuery query,
        CancellationToken ct)
    {
        await WorkspacePermissions.RequireMemberAsync(
            workspaces,
            query.WorkspaceId,
            query.ActorId,
            ct);

        var teamsInWorkspace = await teams.ListAsync(query.WorkspaceId, ct);

        return teamsInWorkspace
            .Select(team => new TeamDto(team.Id, team.WorkspaceId, team.Name))
            .ToArray();
    }
}
