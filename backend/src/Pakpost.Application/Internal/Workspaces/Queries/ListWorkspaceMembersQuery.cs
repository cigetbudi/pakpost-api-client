using Mediator;
using Pakpost.Application.Internal.Workspaces.DTOs;

namespace Pakpost.Application.Internal.Workspaces.Queries;

public sealed record ListWorkspaceMembersQuery(Guid ActorId, Guid WorkspaceId) : IRequest<IReadOnlyList<MemberDto>>;
