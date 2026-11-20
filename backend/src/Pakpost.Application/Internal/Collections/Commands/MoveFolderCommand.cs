using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record MoveFolderCommand(
    Guid ActorId,
    Guid WorkspaceId,
    Guid CollectionId,
    Guid FolderId,
    Guid? TargetParentId,
    int ExpectedVersion,
    Guid? TargetCollectionId = null
) : IRequest<FolderDto>;
