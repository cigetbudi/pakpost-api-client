using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;
using Pakpost.Application.Common.Security;

namespace Pakpost.Application.Internal.Teams;

public sealed class CreateTeamHandler(IWorkspaceRepository w, ITeamRepository t, IUnitOfWork uow) : IRequestHandler<CreateTeamCommand, TeamDto>
{
    public async ValueTask<TeamDto> Handle(CreateTeamCommand q, CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(w, q.WorkspaceId, q.ActorId, WorkspacePermissions.TeamManage, ct);
        var team = new Team(q.WorkspaceId, q.ActorId, q.Name);
        t.Add(team);
        t.AddMember(new TeamMember(team.Id, q.ActorId));
        await uow.SaveChangesAsync(ct);
        return new(team.Id, team.WorkspaceId, team.Name);
    }
}
