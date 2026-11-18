using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Queries;

public sealed record ListCollectionsQuery(Guid ActorId, Guid WorkspaceId) : IRequest<IReadOnlyList<CollectionDto>>;
