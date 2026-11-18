using Mediator;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record DeleteCollectionCommand(Guid ActorId, Guid WorkspaceId, Guid CollectionId) : IRequest;
