using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record CreateCollectionCommand(Guid ActorId, Guid WorkspaceId, string Name) : IRequest<CollectionDto>;
