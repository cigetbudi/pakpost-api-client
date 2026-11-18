using Mediator;
using Pakpost.Application.Internal.Teams.DTOs;

namespace Pakpost.Application.Internal.Teams.Commands;

public sealed record AddTeamMemberCommand(Guid ActorId, Guid WorkspaceId, Guid TeamId, string Email) : IRequest<TeamMemberDto>;
