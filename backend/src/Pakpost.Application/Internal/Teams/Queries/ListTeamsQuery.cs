using Mediator;
using Pakpost.Application.Internal.Teams.DTOs;

namespace Pakpost.Application.Internal.Teams.Queries;

public sealed record ListTeamsQuery(Guid ActorId, Guid WorkspaceId) : IRequest<IReadOnlyList<TeamDto>>;
