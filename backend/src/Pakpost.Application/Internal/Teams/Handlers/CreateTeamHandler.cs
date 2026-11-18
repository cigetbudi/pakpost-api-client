using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Teams.Commands;
using Pakpost.Application.Internal.Teams.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Teams.Handlers;

public sealed class CreateTeamHandler(
    IWorkspaceRepository workspaces,
    ITeamRepository teams,
    IUnitOfWork unitOfWork)
    : IRequestHandler<CreateTeamCommand, TeamDto>
{
    public async ValueTask<TeamDto> Handle(CreateTeamCommand command, CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(
            workspaces,
            command.WorkspaceId,
            command.ActorId,
            WorkspacePermissions.TeamManage,
            ct);

        var team = new Team(command.WorkspaceId, command.ActorId, command.Name);

        teams.Add(team);
        teams.AddMember(new TeamMember(team.Id, command.ActorId));

        await unitOfWork.SaveChangesAsync(ct);

        return new TeamDto(team.Id, team.WorkspaceId, team.Name);
    }
}
