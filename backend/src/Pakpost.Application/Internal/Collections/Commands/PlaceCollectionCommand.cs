using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record PlaceCollectionCommand(Guid ActorId, Guid WorkspaceId, Guid CollectionId,
    Guid? TargetCollectionId, string Placement) : IRequest<CollectionDto>;
