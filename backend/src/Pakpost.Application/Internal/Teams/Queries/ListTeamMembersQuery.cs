using Mediator;
using Pakpost.Application.Internal.Teams.DTOs;

namespace Pakpost.Application.Internal.Teams.Queries;

public sealed record ListTeamMembersQuery(Guid ActorId, Guid WorkspaceId, Guid TeamId) : IRequest<IReadOnlyList<TeamMemberDto>>;
