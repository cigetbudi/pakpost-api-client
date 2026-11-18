using Mediator;
using Pakpost.Application.Internal.Environments.DTOs;

namespace Pakpost.Application.Internal.Environments.Queries;

public sealed record ListEnvironmentsQuery(Guid ActorId, Guid WorkspaceId) : IRequest<IReadOnlyList<RequestEnvironmentDto>>;
