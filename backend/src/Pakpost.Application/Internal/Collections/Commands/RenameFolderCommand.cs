using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed record RenameFolderCommand(
    Guid ActorId,
    Guid WorkspaceId,
    Guid CollectionId,
    Guid FolderId,
    string Name,
    int ExpectedVersion
) : IRequest<FolderDto>;
