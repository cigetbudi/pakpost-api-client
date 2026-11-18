using Mediator;
using Pakpost.Application.Internal.Teams.DTOs;

namespace Pakpost.Application.Internal.Teams.Commands;

public sealed record CreateTeamCommand(Guid ActorId, Guid WorkspaceId, string Name) : IRequest<TeamDto>;
