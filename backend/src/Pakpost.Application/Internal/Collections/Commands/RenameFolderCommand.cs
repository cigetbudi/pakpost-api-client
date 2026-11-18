using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record RenameFolderCommand(
    Guid ActorId,
    Guid WorkspaceId,
    Guid CollectionId,
    Guid FolderId,
    string Name,
    int ExpectedVersion
) : IRequest<FolderDto>;
