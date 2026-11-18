using Mediator;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record DeleteFolderCommand(Guid ActorId, Guid WorkspaceId, Guid CollectionId, Guid FolderId, int ExpectedVersion) : IRequest;
