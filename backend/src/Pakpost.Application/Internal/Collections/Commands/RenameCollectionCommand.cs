using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record RenameCollectionCommand(Guid ActorId, Guid WorkspaceId, Guid CollectionId, string Name) : IRequest<CollectionDto>;
