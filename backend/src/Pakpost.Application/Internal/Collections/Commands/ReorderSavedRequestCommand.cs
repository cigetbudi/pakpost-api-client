using Mediator;

namespace Pakpost.Application.Internal.Collections.Commands;
public sealed record ReorderSavedRequestCommand(Guid ActorId, Guid WorkspaceId,
    Guid CollectionId, Guid RequestId, Guid TargetRequestId, string Placement)
    : IRequest;
