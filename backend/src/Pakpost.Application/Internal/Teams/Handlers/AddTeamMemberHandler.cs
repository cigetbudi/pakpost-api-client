using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Teams.Commands;
using Pakpost.Application.Internal.Teams.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Teams.Handlers;

public sealed class AddTeamMemberHandler(
    IWorkspaceRepository workspaces,
    ITeamRepository teams,
    IUserRepository users,
    IUnitOfWork unitOfWork)
    : IRequestHandler<AddTeamMemberCommand, TeamMemberDto>
{
    public async ValueTask<TeamMemberDto> Handle(
        AddTeamMemberCommand command,
        CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(
            workspaces,
            command.WorkspaceId,
            command.ActorId,
            WorkspacePermissions.TeamManage,
            ct);

        var team = await teams.FindAsync(command.TeamId, ct);

        if (team is null || team.WorkspaceId != command.WorkspaceId)
        {
            throw AppException.NotFound();
        }

        var email = command.Email.Trim().ToLowerInvariant();
        var user = await users.FindByEmailAsync(email, ct)
            ?? throw AppException.NotFound("User must register first");

        if (await workspaces.FindMemberAsync(command.WorkspaceId, user.Id, ct) is null)
        {
            throw AppException.BadRequest("User must join workspace first");
        }

        if (await teams.HasMemberAsync(team.Id, user.Id, ct))
        {
            throw AppException.Conflict("Already a team member");
        }

        teams.AddMember(new TeamMember(team.Id, user.Id));
        await unitOfWork.SaveChangesAsync(ct);

        return new TeamMemberDto(user.Id, user.Email, user.DisplayName);
    }
}
